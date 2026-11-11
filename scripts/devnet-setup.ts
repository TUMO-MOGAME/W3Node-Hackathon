/**
 * Devnet setup for the Heirloom demo (idempotent: re-running reuses what exists).
 *  1. Creates Tether WDK wallets for every persona (scripts/.demo-wallets.json, gitignored)
 *  2. Airdrops devnet SOL to the dad, who funds everyone else with a WDK native transfer
 *  3. Creates a 6-decimal test USD₮ mint and the car's digital-title NFT (decimals 0, supply 1)
 *  4. Mints test USD₮ to the dad and sends buyers their share with WDK `transfer` (SPL USD₮)
 *  5. Prints the .env.local lines
 * Run from app/:  npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/devnet-setup.ts
 */
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  AuthorityType, MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction,
  createMintToCheckedInstruction, createSetAuthorityInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { PERSONAS, ROOT, connection, disposeAll, explorer, loadEnv, loadOrCreateWallets, log, saveWallets, send, wdk, type PersonaId } from "./_shared";

const USDT = 1_000_000n;
const SOL_TARGET: Partial<Record<PersonaId, number>> = {
  agent: 0.3, pieter: 0.1, ayesha: 0.1, lerato: 0.06, sipho: 0.06, naledi: 0.06, ndlovu: 0.03, pillay: 0.03, bongani: 0.03,
};
const USDT_GRANTS: Partial<Record<PersonaId, bigint>> = { pieter: 12_000n * USDT, ayesha: 9_500n * USDT };

async function main() {
  loadEnv();
  const conn = connection();
  const w = await loadOrCreateWallets();
  log(`Wallets: ${Object.keys(w.addresses).length} WDK wallets in scripts/.demo-wallets.json`);
  const dad = await wdk(w, "dad");
  const dadKey = new PublicKey(dad.address);

  // 1. SOL for the dad (devnet faucet is rate-limited; fall back to instructions).
  let bal = await conn.getBalance(dadKey);
  if (bal < 1.2 * LAMPORTS_PER_SOL) {
    try {
      log("Requesting 2 devnet SOL airdrop for the dad…");
      const sig = await conn.requestAirdrop(dadKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig, "confirmed");
      bal = await conn.getBalance(dadKey);
    } catch (e) {
      console.error(`Airdrop failed (${(e as Error).message}). Fund ${dad.address} at https://faucet.solana.com (devnet) and re-run.`);
      if (bal < 0.5 * LAMPORTS_PER_SOL) process.exit(1);
    }
  }
  log(`Dad ${dad.address}: ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL`);

  // 2. Dad funds everyone else with WDK native SOL transfers.
  for (const [id, target] of Object.entries(SOL_TARGET) as [PersonaId, number][]) {
    const to = w.addresses[id];
    const have = await conn.getBalance(new PublicKey(to));
    const need = Math.round(target * LAMPORTS_PER_SOL) - have;
    if (need > 5000) {
      const { hash } = await dad.account.sendTransaction({ to, value: BigInt(need) });
      await conn.confirmTransaction(hash, "confirmed");
      log(`SOL → ${id} (${(need / LAMPORTS_PER_SOL).toFixed(3)}) ${explorer(hash)}`);
    }
  }

  // 3a. Test USD₮ mint (6 dp), mint authority = dad.
  const rentMint = await getMinimumBalanceForRentExemptMint(conn);
  if (!w.usdtMint && process.env.NEXT_PUBLIC_USDT_MINT) w.usdtMint = process.env.NEXT_PUBLIC_USDT_MINT;
  if (!w.usdtMint) {
    const mint = Keypair.generate();
    const sig = await send(dad, [
      SystemProgram.createAccount({ fromPubkey: dadKey, newAccountPubkey: mint.publicKey, lamports: rentMint, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
      createInitializeMint2Instruction(mint.publicKey, 6, dadKey, null),
    ], [mint]);
    w.usdtMint = mint.publicKey.toBase58();
    saveWallets(w);
    log(`Test USD₮ mint ${w.usdtMint} ${explorer(sig)}`);
  }
  const usdtMint = new PublicKey(w.usdtMint);

  // 3b. Car digital title: decimals 0, mint exactly 1 to the dad, then remove the mint authority (supply fixed at 1).
  if (!w.carMint) {
    const car = Keypair.generate();
    const dadCar = getAssociatedTokenAddressSync(car.publicKey, dadKey);
    const sig = await send(dad, [
      SystemProgram.createAccount({ fromPubkey: dadKey, newAccountPubkey: car.publicKey, lamports: rentMint, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
      createInitializeMint2Instruction(car.publicKey, 0, dadKey, null),
      createAssociatedTokenAccountIdempotentInstruction(dadKey, dadCar, dadKey, car.publicKey),
      createMintToCheckedInstruction(car.publicKey, dadCar, dadKey, 1, 0),
      createSetAuthorityInstruction(car.publicKey, dadKey, AuthorityType.MintTokens, null),
    ], [car]);
    w.carMint = car.publicKey.toBase58();
    saveWallets(w);
    log(`Car title NFT ${w.carMint} (supply 1, authority removed) ${explorer(sig)}`);
  }

  // 4. Mint USD₮ to the dad (top up to 25,000 + buyer grants), then WDK `transfer` to buyers.
  const dadUsdt = getAssociatedTokenAddressSync(usdtMint, dadKey);
  const want = 25_000n * USDT + Object.values(USDT_GRANTS).reduce((a, b) => a + (b ?? 0n), 0n);
  const have = await conn.getTokenAccountBalance(dadUsdt).then((b) => BigInt(b.value.amount)).catch(() => 0n);
  if (have < want) {
    const sig = await send(dad, [
      createAssociatedTokenAccountIdempotentInstruction(dadKey, dadUsdt, dadKey, usdtMint),
      createMintToCheckedInstruction(usdtMint, dadUsdt, dadKey, want - have, 6),
    ]);
    log(`Minted ${(want - have) / USDT} test USD₮ to the dad ${explorer(sig)}`);
  }
  for (const [id, amount] of Object.entries(USDT_GRANTS) as [PersonaId, bigint][]) {
    const buyer = new PublicKey(w.addresses[id]);
    const got = await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(usdtMint, buyer)).then((b) => BigInt(b.value.amount)).catch(() => 0n);
    if (got < amount) {
      const { hash } = await dad.account.transfer({ token: usdtMint.toBase58(), recipient: buyer.toBase58(), amount: amount - got });
      await conn.confirmTransaction(hash, "confirmed");
      log(`WDK USD₮ transfer → ${id}: ${(amount - got) / USDT} ${explorer(hash)}`);
    }
  }

  // 5. Env lines → scripts/.env.devnet (gitignored). The agent seed is written to the file, never printed.
  const env = [
    "NEXT_PUBLIC_DATA_MODE=chain",
    "NEXT_PUBLIC_SOLANA_CLUSTER=devnet",
    `NEXT_PUBLIC_USDT_MINT=${w.usdtMint}`,
    "NEXT_PUBLIC_DEMO_WAITING_SECS=60",
    "NEXT_PUBLIC_DEMO_INTERVAL_SECS=60",
    `SCHEDULER_SECRET=${randomBytes(24).toString("hex")}`,
    `# server only: the agent's WDK wallet (${w.addresses.agent})`,
    `AGENT_SEED_PHRASE="${w.seeds.agent}"`,
    `# car digital title mint: ${w.carMint}`,
  ].join("\n");
  writeFileSync(join(ROOT, ".env.devnet"), env + "\n", { mode: 0o600 });
  console.log("\nWrote scripts/.env.devnet: copy its lines into app/.env.local (it contains the agent seed; keep it private).");
  console.log(`NEXT_PUBLIC_USDT_MINT=${w.usdtMint}\nCar title mint: ${w.carMint}\nAgent wallet: ${w.addresses.agent}`);
  console.log("\nDemo personas (seeds are in scripts/.demo-wallets.json; import them in the app with a PIN):");
  for (const p of PERSONAS) console.log(`  ${p.id.padEnd(10)} ${w.addresses[p.id]}  ${p.label}`);
  disposeAll();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); disposeAll(); process.exit(1); });
