/**
 * Full-story rehearsal on Solana devnet, on a THROWAWAY estate (the demo estate is not touched):
 * a fresh owner wallet sets up an estate → a child reports the passing → the agent reviews it → two trusted
 * people confirm → the waiting period runs → the estate unlocks → a university claim is reviewed, approved and paid
 * → the car is listed, a buyer offers, the agent accepts and the proceeds land in the vault.
 * Tiny amounts (test USD₮). Every step is a real devnet transaction; Explorer links are printed.
 *
 * Run from app/ with the devnet env loaded (scripts/.env.devnet):
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/rehearse-devnet.ts
 */
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  AuthorityType, MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction,
  createMintToCheckedInstruction, createSetAuthorityInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { loadEnv, loadOrCreateWallets, wdk, send, explorer, log, disposeAll, connection, rpcUrl, type PersonaId } from "./_shared";

loadEnv();
const WAIT = 20; // seconds: the throwaway estate's waiting period

async function main() {
  const w = await loadOrCreateWallets();
  process.env.NEXT_PUBLIC_USDT_MINT ||= w.usdtMint!;
  const ix = await import("../app/src/lib/chain/instructions");
  const { chainCtx } = await import("../app/src/lib/chain/client");
  const { estatePda, claimPda, assetPda } = await import("../app/src/lib/chain/pda");
  const { fetchEstateRaw } = await import("../app/src/lib/chain/reads");
  const { toBase, fromBase } = await import("../app/src/lib/format");
  const { sha256Hex } = await import("../app/src/lib/agent/hash");
  const { newSeedPhrase, openAccount } = await import("../app/src/lib/wallet/wdk");

  const ctx = chainCtx();
  const conn = connection();
  const A = (id: PersonaId) => new PublicKey(w.addresses[id]);
  const step = async (label: string, payer: Awaited<ReturnType<typeof wdk>>, ixs: Parameters<typeof send>[1], extra: Keypair[] = []) => {
    const sig = await send(payer, ixs, extra);
    log(`${label} ${explorer(sig)}`);
  };
  const dad = await wdk(w, "dad"), agent = await wdk(w, "agent"), lerato = await wdk(w, "lerato");
  const ndlovu = await wdk(w, "ndlovu"), pillay = await wdk(w, "pillay"), pieter = await wdk(w, "pieter");

  // 0. A fresh owner wallet (in memory only), funded by the dad with a little SOL and 30 test USD₮.
  const ownerAcc = await openAccount(await newSeedPhrase(), rpcUrl());
  const owner = new PublicKey(ownerAcc.address);
  const mint = new PublicKey(w.usdtMint!);
  const ownerUsdt = getAssociatedTokenAddressSync(mint, owner);
  await step(`Owner ${owner.toBase58().slice(0, 6)}… funded: 0.06 SOL + 30 USD₮`, dad, [
    SystemProgram.transfer({ fromPubkey: A("dad"), toPubkey: owner, lamports: 60_000_000 }),
    createAssociatedTokenAccountIdempotentInstruction(A("dad"), ownerUsdt, owner, mint),
    createMintToCheckedInstruction(mint, ownerUsdt, A("dad"), toBase(30), 6),
  ]);

  // 1. Estate, child, university, after-death tuition rule, 20 USD₮ in the vault.
  const estate = estatePda(ctx.programId, owner);
  await step(`Estate ${estate.toBase58().slice(0, 6)}… created (waiting period ${WAIT}s)`, ownerAcc, [
    ix.createEstate(ctx, { owner, agent: A("agent"), verifiers: [A("ndlovu"), A("pillay"), A("bongani")], deathThreshold: 2, claimThreshold: 1, hardshipThreshold: 2, waitingPeriodSecs: WAIT }),
    ix.setWill(ctx, owner, await sha256Hex(`rehearsal-will:${owner.toBase58()}`), "heirloom:rehearsal"),
  ]);
  await step("Child, university and tuition rule added", ownerAcc, [
    ix.addBeneficiary(ctx, owner, A("lerato"), "Lerato (daughter)"),
    ix.addPayee(ctx, owner, A("uct"), "University", "University of Cape Town"),
    ix.addRule(ctx, owner, { ruleId: 0, beneficiaryWallet: A("lerato"), category: "Tuition", allowedPayeeKind: "University", maxPerClaim: toBase(5), lifetimeCap: toBase(20), validUntil: Math.floor(Date.now() / 1000) + 365 * 86400 }),
  ]);
  await step("Vault funded with 20 USD₮", ownerAcc, [ix.deposit(ctx, owner, toBase(20))]);

  // 2. Car title NFT (supply 1) registered: floor 10, hardship floor 8, asking 12; proceeds go to the vault.
  const car = Keypair.generate();
  const ownerCar = getAssociatedTokenAddressSync(car.publicKey, owner);
  await step("Car title minted (supply 1)", ownerAcc, [
    SystemProgram.createAccount({ fromPubkey: owner, newAccountPubkey: car.publicKey, lamports: await getMinimumBalanceForRentExemptMint(conn), space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
    createInitializeMint2Instruction(car.publicKey, 0, owner, null),
    createAssociatedTokenAccountIdempotentInstruction(owner, ownerCar, owner, car.publicKey),
    createMintToCheckedInstruction(car.publicKey, ownerCar, owner, 1, 0),
    createSetAuthorityInstruction(car.publicKey, owner, AuthorityType.MintTokens, null),
  ], [car]);
  await step("Car registered with the estate", ownerAcc, [ix.registerAsset(ctx, owner, {
    nftMint: car.publicKey, floorPrice: toBase(10), hardshipFloor: toBase(8), askingPrice: toBase(12), proceedsTo: estate,
    docHashHex: await sha256Hex(`rehearsal-car:${car.publicKey.toBase58()}`),
  })]);

  // 3. The passing: reported by the child, reviewed by the agent, confirmed by two trusted people.
  await step("Lerato reported the passing", lerato, [ix.submitDeathClaim(ctx, estate, A("lerato"), await sha256Hex(`rehearsal-cert:${estate.toBase58()}`))]);
  await step("Agent reviewed the certificate: approved", agent, [ix.reviewDeath(estate, A("agent"), true, await sha256Hex("rehearsal-death-report"))]);
  await step("Adv. Ndlovu confirmed", ndlovu, [ix.attestDeath(estate, A("ndlovu"))]);
  await step("Ms. Pillay confirmed → waiting period starts", pillay, [ix.attestDeath(estate, A("pillay"))]);
  log(`Waiting ${WAIT + 8}s…`);
  await new Promise((r) => setTimeout(r, (WAIT + 8) * 1000));
  await step("Estate unlocked", lerato, [ix.finalizeUnlock(estate, A("lerato"))]);

  // 4. A university claim: submitted, reviewed by the agent, approved by one trusted person, paid from the vault.
  const rule = (await fetchEstateRaw(estate.toBase58())).rules[0];
  const claim = claimPda(ctx.programId, rule.address, 0);
  await step("Lerato claimed 5 USD₮ for fees", lerato, [ix.submitClaim(ctx, { estate, signer: A("lerato"), ruleId: 0, claimId: 0, payeeWallet: A("uct"), amount: toBase(5), evidenceHashHex: await sha256Hex("rehearsal-invoice") })]);
  await step("Agent reviewed the invoice: approved", agent, [ix.reviewClaim(estate, A("agent"), claim, new PublicKey(rule.address), true, await sha256Hex("rehearsal-claim-report"))]);
  await step("Adv. Ndlovu approved the claim", ndlovu, [ix.approveClaim(estate, A("ndlovu"), claim, new PublicKey(rule.address))]);
  const uctBefore = await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, A("uct"))).then((b) => Number(b.value.uiAmount)).catch(() => 0);
  await step("Claim paid to the university", agent, [ix.executeClaim(ctx, { estate, payer: A("agent"), rule: new PublicKey(rule.address), claim, payeeWallet: A("uct") })]);

  // 5. Car sale: listed by the agent, Pieter offers 11 (above the floor), the agent accepts, proceeds go to the vault.
  const asset = assetPda(ctx.programId, estate, car.publicKey);
  await step("Car listed", agent, [ix.listAsset(estate, A("agent"), asset, 3600)]);
  await step("Pieter offered 11 USD₮ (held in escrow)", pieter, [ix.placeOffer(ctx, estate, asset, A("pieter"), toBase(11))]);
  await step("Agent accepted the best offer: car to Pieter, money to the vault", agent, [ix.acceptOffer(ctx, { estate, agent: A("agent"), asset, nftMint: car.publicKey, buyer: A("pieter"), recipient: estate })]);

  // 6. Checks.
  const s = await fetchEstateRaw(estate.toBase58());
  const uctAfter = await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, A("uct"))).then((b) => Number(b.value.uiAmount));
  const pieterCar = await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(car.publicKey, A("pieter"))).then((b) => Number(b.value.amount));
  console.log(`\nEstate ${s.estate.status}; claim ${s.claims[0]?.status}; university +${(uctAfter - uctBefore).toFixed(2)} USD₮; car ${s.assets[0]?.status}, Pieter holds ${pieterCar} title; vault ${fromBase(s.estate.vaultBalance ?? 0n)} USD₮`);
  console.log(`https://explorer.solana.com/address/${estate.toBase58()}?cluster=devnet`);
  ownerAcc.manager.dispose();
}

main().then(() => disposeAll()).catch((e) => { console.error(e instanceof Error ? e.message : e); disposeAll(); process.exit(1); });
