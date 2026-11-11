/**
 * Devnet check of fee sponsorship: Lerato sends 1 USD₮ to Sipho with the agent's WDK wallet as fee payer, through
 * the same server code /api/sponsor uses (validate → simulate → co-sign), then we broadcast the stored bytes
 * (pay-once order). Asserts Lerato's SOL did not change, and that a malicious tx is refused.
 *
 * Run from app/ (scripts/tsconfig.json maps server-only to an empty module):
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/sponsor-devnet.ts [envFile] [walletsFile]
 * Never prints seeds.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ROOT, type WalletsFile } from "./_shared";

const envFile = process.argv[2] ?? join(ROOT, ".env.devnet");
const walletsFile = process.argv[3] ?? join(ROOT, ".demo-wallets.json");
process.loadEnvFile(envFile);
process.env.NEXT_PUBLIC_DATA_MODE = "chain";

async function main() {
  // Import after the env is loaded: chain config reads it at module load.
  const { openAccount, wdkPartialSign } = await import("../app/src/lib/wallet/wdk");
  const { getConnection, base64ToBytes, bytesToBase64, confirmOrThrow } = await import("../app/src/lib/chain/tx");
  const { chainConfig } = await import("../app/src/lib/chain/config");
  const { sponsorInfo, sponsorTransaction } = await import("../app/src/lib/sponsor/server");

  const w = JSON.parse(readFileSync(walletsFile, "utf8")) as WalletsFile;
  const conn = getConnection();
  const mint = new PublicKey(chainConfig.usdtMint);
  const info = await sponsorInfo(conn);
  console.log("sponsor:", { available: info.available, feePayer: info.feePayer, sol: (info.balanceLamports ?? 0) / 1e9, paysRent: info.paysRent });
  if (!info.available || !info.feePayer) throw new Error(info.reason ?? "sponsor unavailable");
  const sponsor = new PublicKey(info.feePayer);

  const lerato = await openAccount(w.seeds.lerato, chainConfig.rpcUrl);
  const from = new PublicKey(lerato.address), to = new PublicKey(w.addresses.sipho);
  const fromAta = getAssociatedTokenAddressSync(mint, from), toAta = getAssociatedTokenAddressSync(mint, to);
  const bal = async () => ({
    leratoSol: await conn.getBalance(from, "confirmed"),
    sponsorSol: await conn.getBalance(sponsor, "confirmed"),
    leratoUsdt: (await conn.getTokenAccountBalance(fromAta, "confirmed").catch(() => null))?.value.amount ?? "0",
    siphoUsdt: (await conn.getTokenAccountBalance(toAta, "confirmed").catch(() => null))?.value.amount ?? "0",
  });
  const before = await bal();
  console.log("before:", before);

  // 1) Malicious tx must be refused: SOL transfer out of the sponsor, disguised next to a USD₮ transfer.
  {
    const { blockhash } = await conn.getLatestBlockhash("confirmed");
    const bad = new Transaction({ feePayer: sponsor, recentBlockhash: blockhash }).add(
      SystemProgram.transfer({ fromPubkey: sponsor, toPubkey: from, lamports: 1_000_000 }),
      createTransferCheckedInstruction(fromAta, mint, toAta, from, 1n, 6),
    );
    const partial = await wdkPartialSign(lerato.account, bytesToBase64(bad.serialize({ requireAllSignatures: false, verifySignatures: false })));
    const refused = await sponsorTransaction(partial.wireBase64, { submit: false }, conn).then(() => null, (e: Error) => `${e.name}: ${e.message}`);
    if (!refused) throw new Error("SECURITY: the sponsor co-signed a SOL transfer from itself");
    console.log("malicious tx refused ->", refused);
  }

  // 2) Real sponsored payment: 1 USD₮ Lerato → Sipho, fee payer = sponsor.
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const needsAta = !(await conn.getAccountInfo(toAta, "confirmed"));
  const tx = new Transaction({ feePayer: sponsor, blockhash, lastValidBlockHeight }).add(
    ...(needsAta ? [createAssociatedTokenAccountIdempotentInstruction(sponsor, toAta, to, mint)] : []),
    createTransferCheckedInstruction(fromAta, mint, toAta, from, 1_000_000n, 6),
  );
  const partial = await wdkPartialSign(lerato.account, bytesToBase64(tx.serialize({ requireAllSignatures: false, verifySignatures: false })));
  const res = await sponsorTransaction(partial.wireBase64, { submit: false }, conn);
  console.log("co-signed (stored before broadcast in the app):", { signature: res.signature, feeLamports: res.feeLamports, rentLamports: res.rentLamports });
  await conn.sendRawTransaction(base64ToBytes(res.wireBase64), { maxRetries: 3 });
  await confirmOrThrow(res.signature, conn);

  const after = await bal();
  console.log("after:", after);
  console.log("explorer:", `https://explorer.solana.com/tx/${res.signature}?cluster=devnet`);
  if (after.leratoSol !== before.leratoSol) throw new Error("Lerato's SOL changed: sponsorship did not cover the fee");
  if (BigInt(before.leratoUsdt) - BigInt(after.leratoUsdt) !== 1_000_000n) throw new Error("Lerato's USD₮ did not drop by exactly 1");
  console.log(`OK: Lerato's SOL unchanged (${before.leratoSol} lamports); sponsor paid ${before.sponsorSol - after.sponsorSol} lamports.`);
  lerato.manager.dispose();
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
