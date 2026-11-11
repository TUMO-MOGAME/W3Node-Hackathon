/**
 * Seeds the demo estate on devnet from a fixed WillDraft (idempotent; skips what already exists):
 * dad creates the estate (agent + 3 verifiers, thresholds 2/1/2), signs the will hash, adds 3 children,
 * payees (UCT, a residence, a school), the payout rules (two are living plans: a recurring residence payment and
 * school fees that work while the dad is alive), deposits 20,000 test USD₮ and registers the car
 * (floor 9,000 / hardship floor 7,000 / asking 10,500; sale proceeds flow back into the estate vault).
 * Every transaction is signed by the dad's Tether WDK wallet.
 *
 * Needs: scripts/devnet-setup.ts run first, the program deployed, and in app/.env.local
 * NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID + NEXT_PUBLIC_USDT_MINT (+ SUPABASE_* to store display names).
 * Run from app/:  npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/seed-demo.ts
 */
import { PublicKey } from "@solana/web3.js";
import { loadEnv, loadOrCreateWallets, wdk, send, explorer, log, disposeAll, connection, type WalletsFile, type PersonaId } from "./_shared";

loadEnv(); // before importing app modules: chain/config reads env at import time

async function main() {
  const { DEMO_WILL } = await import("../app/src/lib/agent/canned");
  const { hashJson } = await import("../app/src/lib/agent/hash");
  const { willDraftChecked } = await import("../app/src/lib/agent/schemas");
  const ix = await import("../app/src/lib/chain/instructions");
  const { chainCtx } = await import("../app/src/lib/chain/client");
  const { estatePda, beneficiaryPda, payeePda, assetPda } = await import("../app/src/lib/chain/pda");
  const { fetchAccountRaw } = await import("../app/src/lib/chain/reads");
  const { num } = await import("../app/src/lib/chain/decoders");
  const { toBase } = await import("../app/src/lib/format");
  const { intervalSecs } = await import("../app/src/lib/agent/schemas");
  const { sha256Hex } = await import("../app/src/lib/agent/hash");

  if (!process.env.NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID) throw new Error("Set NEXT_PUBLIC_HEIRLOOM_PROGRAM_ID in app/.env.local (deployed program id).");
  const w: WalletsFile = await loadOrCreateWallets();
  if (!w.usdtMint || !w.carMint) throw new Error("Run scripts/devnet-setup.ts first (no test USD₮ / car mint yet).");
  if (process.env.NEXT_PUBLIC_USDT_MINT && process.env.NEXT_PUBLIC_USDT_MINT !== w.usdtMint) {
    throw new Error(`NEXT_PUBLIC_USDT_MINT (${process.env.NEXT_PUBLIC_USDT_MINT}) differs from the setup mint ${w.usdtMint}.`);
  }
  process.env.NEXT_PUBLIC_USDT_MINT = w.usdtMint;

  const ctx = chainCtx();
  const A = (id: PersonaId) => new PublicKey(w.addresses[id]);
  const dad = await wdk(w, "dad");
  const owner = A("dad");
  const estate = estatePda(ctx.programId, owner);
  const exists = async (type: string, a: PublicKey) => Boolean(await fetchAccountRaw(type, a.toBase58()));

  // The fixed will, with the demo wallets filled in.
  const wallets: Record<string, PersonaId> = { "Lerato (daughter)": "lerato", "Sipho (son)": "sipho", "Naledi (daughter)": "naledi" };
  const draft = willDraftChecked.parse({
    ...DEMO_WILL,
    beneficiaries: DEMO_WILL.beneficiaries.map((b) => ({ ...b, wallet: w.addresses[wallets[b.label]] })),
    verifiers: DEMO_WILL.verifiers.map((v, i) => ({ ...v, wallet: w.addresses[(["ndlovu", "pillay", "bongani"] as const)[i]] })),
  });
  const willHash = await hashJson(draft);
  const waiting = Number(process.env.NEXT_PUBLIC_DEMO_WAITING_SECS || 60);

  // 1. Estate + will
  const setup = [];
  if (!(await exists("Estate", estate))) {
    setup.push(ix.createEstate(ctx, {
      owner, agent: A("agent"), verifiers: [A("ndlovu"), A("pillay"), A("bongani")],
      deathThreshold: 2, claimThreshold: 1, hardshipThreshold: 2, waitingPeriodSecs: waiting,
    }));
  }
  setup.push(ix.setWill(ctx, owner, willHash, `heirloom:will:${willHash.slice(0, 16)}`));
  log(`Estate ${estate.toBase58()} + will ${willHash.slice(0, 12)}… ${explorer(await send(dad, setup))}`);

  // 2. Beneficiaries
  const benIxs = [];
  for (const b of draft.beneficiaries) {
    if (!(await exists("Beneficiary", beneficiaryPda(ctx.programId, estate, b.wallet!)))) benIxs.push(ix.addBeneficiary(ctx, owner, new PublicKey(b.wallet!), b.label));
  }
  if (benIxs.length) log(`Beneficiaries ×${benIxs.length} ${explorer(await send(dad, benIxs))}`);

  // 3. Payees (approved institutions)
  const payees: [PersonaId, "University" | "Landlord" | "School", string][] = [
    ["uct", "University", "University of Cape Town"], ["residence", "Landlord", "Tugwell Residence"], ["school", "School", "Westerford High School"],
  ];
  const payeeIxs = [];
  for (const [id, kind, name] of payees) {
    if (!(await exists("Payee", payeePda(ctx.programId, estate, A(id))))) payeeIxs.push(ix.addPayee(ctx, owner, A(id), kind, name));
  }
  if (payeeIxs.length) log(`Payees ×${payeeIxs.length} ${explorer(await send(dad, payeeIxs))}`);

  // 4. Rules (only on a fresh estate: rule ids follow rule_count)
  const est = await fetchAccountRaw("Estate", estate.toBase58());
  let ruleId = est ? num(est, "rule_count") : 0;
  if (ruleId === 0) {
    const byName: Record<string, PersonaId> = Object.fromEntries(payees.map(([id, , name]) => [name.toLowerCase(), id]));
    const now = Math.floor(Date.now() / 1000);
    const { findInstruction } = await import("../app/src/lib/chain/idl");
    const living = findInstruction("add_rule").args.length > 5; // older program builds have no living plans
    if (!living) log("Program has no living-plan support yet: rules are created as after-death, claim-based rules");
    const ruleIxs = draft.rules.map((r) => {
      const payeeId = r.recurring ? byName[r.recurring.payeeName.toLowerCase()] : undefined;
      const every = r.recurring ? intervalSecs(r.recurring.every) : 0;
      return ix.addRule(ctx, owner, {
        ruleId: ruleId++, beneficiaryWallet: new PublicKey(draft.beneficiaries.find((b) => b.label === r.beneficiaryLabel)!.wallet!),
        category: r.category, allowedPayeeKind: r.allowedPayeeKind, maxPerClaim: toBase(r.maxPerClaimUsdt),
        lifetimeCap: toBase(r.lifetimeCapUsdt), validUntil: Math.floor(Date.parse(r.validUntil) / 1000),
        startsNow: living && r.startsNow,
        recurring: living && r.recurring && payeeId ? { amount: toBase(r.recurring.amountUsdt), intervalSecs: every, firstDue: now + every, payeeWallet: A(payeeId) } : undefined,
      });
    });
    for (let i = 0; i < ruleIxs.length; i += 2) log(`Rules ${i}-${Math.min(i + 1, ruleIxs.length - 1)} ${explorer(await send(dad, ruleIxs.slice(i, i + 2)))}`);
  } else log(`Rules already present (${ruleId})`);

  // 5. Deposit
  const vaultBal = await connection().getTokenAccountBalance((await import("../app/src/lib/chain/pda")).vaultAta(ctx.usdtMint, estate))
    .then((b) => BigInt(b.value.amount)).catch(() => 0n);
  if (vaultBal < toBase(20_000)) log(`Deposit ${explorer(await send(dad, [ix.deposit(ctx, owner, toBase(20_000) - vaultBal)]))}`);

  // 6. Car digital title (proceeds go back to the estate: recipient = Estate PDA, whose USD₮ ATA is the vault)
  const carMint = new PublicKey(w.carMint);
  const car = draft.assets[0];
  if (!(await exists("Asset", assetPda(ctx.programId, estate, carMint)))) {
    const docHash = await sha256Hex(`heirloom-demo:registration:${car.title}:${w.carMint}`);
    log(`Car registered ${explorer(await send(dad, [ix.registerAsset(ctx, owner, {
      nftMint: carMint, floorPrice: toBase(car.floorPriceUsdt), hardshipFloor: toBase(car.hardshipFloorUsdt),
      askingPrice: toBase(car.askingPriceUsdt), proceedsTo: estate, docHashHex: docHash,
    })]))}`);
  }

  // 7. Off-chain display names (Supabase) so the UI shows names instead of addresses.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { error } = await sb.from("estate_meta").upsert({
      estate: estate.toBase58(), owner_wallet: owner.toBase58(), owner_name: draft.ownerName,
      verifier_names: draft.verifiers.map((v) => v.name), asset_titles: { [w.carMint]: car.title },
      buyer_names: { [w.addresses.pieter]: "Pieter", [w.addresses.ayesha]: "Ayesha" },
    });
    await sb.from("will_drafts").insert({ owner_wallet: owner.toBase58(), draft, will_hash: willHash });
    log(error ? `Supabase names not saved: ${error.message}` : "Display names saved to Supabase");
  } else log("SUPABASE_* not set: display names not stored (the app will show defaults)");

  console.log(`\nDemo estate ready: ${estate.toBase58()}\nhttps://explorer.solana.com/address/${estate.toBase58()}?cluster=devnet`);
  disposeAll();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); disposeAll(); process.exit(1); });
