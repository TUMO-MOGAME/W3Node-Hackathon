/**
 * Gives the devnet demo estate a real history while the dad is alive, so every screen has something to show:
 *  1. scheduled (living-plan) payments that are due are paid by the agent wallet (anyone may trigger them);
 *  2. a child's fee claim under a "starts now" rule: the child submits, the dad approves, the agent executes;
 *  3. the dad tops up the vault;
 *  4. the dad sends pocket money to a child (a plain WDK USD₮ transfer).
 * Every step is a real devnet transaction; Explorer links are printed. The estate stays Active, so the passing →
 * unlock → claims → car sale story can still be shown live.
 *
 * Run from app/ with the devnet env loaded (scripts/.env.devnet):
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/demo-history.ts [--dry]
 */
import { PublicKey } from "@solana/web3.js";
import { createTransferCheckedInstruction, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { loadEnv, loadOrCreateWallets, wdk, send, explorer, log, disposeAll, type PersonaId } from "./_shared";

loadEnv();
const DRY = process.argv.includes("--dry");

async function main() {
  const w = await loadOrCreateWallets();
  if (!w.usdtMint) throw new Error("No test USD₮ mint: run scripts/devnet-setup.ts first.");
  process.env.NEXT_PUBLIC_USDT_MINT ||= w.usdtMint;
  const ix = await import("../app/src/lib/chain/instructions");
  const { chainCtx } = await import("../app/src/lib/chain/client");
  const { estatePda, claimPda } = await import("../app/src/lib/chain/pda");
  const { fetchEstateRaw } = await import("../app/src/lib/chain/reads");
  const { toBase, fromBase } = await import("../app/src/lib/format");
  const { sha256Hex } = await import("../app/src/lib/agent/hash");

  const ctx = chainCtx();
  const A = (id: PersonaId) => new PublicKey(w.addresses[id]);
  const who = (addr: string) => (Object.entries(w.addresses).find(([, a]) => a === addr)?.[0] ?? addr.slice(0, 6)) as PersonaId;
  const estate = estatePda(ctx.programId, A("dad"));
  const snap = async () => fetchEstateRaw(estate.toBase58());
  let s = await snap();
  const now = Math.floor(Date.now() / 1000);

  console.log(`Estate ${estate.toBase58()}: ${s.estate.status}`);
  for (const r of s.rules) {
    console.log(`  rule #${r.id} ${who(r.beneficiary)} ${r.category} → ${r.allowedPayeeKind}; startsNow=${r.startsNow} cap ${fromBase(r.maxPerClaim)}/${fromBase(r.lifetimeCap)} spent ${fromBase(r.spentTotal)}` +
      (r.recurringAmount > 0n ? `; every ${r.intervalSecs}s ${fromBase(r.recurringAmount)} to ${who(r.fixedPayee ?? "")}, due ${r.nextDue && r.nextDue <= now ? "NOW" : r.nextDue}` : ""));
  }
  console.log(`  claims: ${s.claims.length} (${s.claims.map((c) => c.status).join(", ") || "none"})`);
  if (DRY) return;
  if (s.estate.status !== "Active") throw new Error("This script only adds history while the dad is alive (estate Active).");

  const agent = await wdk(w, "agent");
  const dad = await wdk(w, "dad");

  // 1. Scheduled payments that are due.
  for (const r of s.rules.filter((r) => r.startsNow && r.recurringAmount > 0n && r.fixedPayee && r.nextDue !== null && r.nextDue <= now)) {
    const sig = await send(agent, [ix.executeScheduled(ctx, { estate, payer: A("agent"), rule: new PublicKey(r.address), payeeWallet: new PublicKey(r.fixedPayee!) })]);
    log(`Scheduled payment, rule #${r.id}: ${fromBase(r.recurringAmount)} USD₮ to ${who(r.fixedPayee!)} ${explorer(sig)}`);
  }

  // 2. A fee claim under a "starts now" claim rule (not a scheduled one), paid to a matching approved payee.
  const claimRule = s.rules.find((r) => r.startsNow && r.recurringAmount === 0n && s.payees.some((p) => p.kind === r.allowedPayeeKind));
  if (claimRule && !s.claims.some((c) => c.rule === claimRule.address && c.status === "Paid")) {
    const child = who(claimRule.beneficiary);
    const payee = s.payees.find((p) => p.kind === claimRule.allowedPayeeKind)!;
    const amount = Math.min(350, fromBase(claimRule.maxPerClaim));
    const ruleKey = new PublicKey(claimRule.address);
    // Resume an open claim from an earlier run instead of submitting a second one.
    let open = s.claims.find((c) => c.rule === claimRule.address && c.status === "Open");
    let claim: PublicKey;
    if (open) {
      claim = new PublicKey(open.address);
      log(`Resuming open claim #${open.id} (${fromBase(open.amount)} USD₮)`);
    } else {
      const claimId = s.claims.filter((c) => c.rule === claimRule.address).length;
      claim = claimPda(ctx.programId, claimRule.address, claimId);
      const evidence = await sha256Hex(`heirloom-demo:invoice:${payee.name}:${amount}:${now}`);
      log(`Claim submitted by ${child}: ${amount} USD₮ to ${payee.name} ${explorer(await send(await wdk(w, child), [ix.submitClaim(ctx, {
        estate, signer: A(child), ruleId: claimRule.id, claimId, payeeWallet: new PublicKey(payee.wallet), amount: toBase(amount), evidenceHashHex: evidence,
      })]))}`);
    }
    // The AI agent's review comes first: the program refuses any approval until the agent's verdict is Approved.
    if (open?.agentVerdict !== "Approved") {
      const report = await sha256Hex(`heirloom-demo:agent-report:${claim.toBase58()}:invoice matches the school, amount within the cap`);
      log(`Agent reviewed the invoice: approved ${explorer(await send(agent, [ix.reviewClaim(estate, A("agent"), claim, ruleKey, true, report)]))}`);
    }
    if (!open?.ownerApproved) log(`Claim approved by the dad ${explorer(await send(dad, [ix.ownerApproveClaim(ctx, A("dad"), claim, ruleKey)]))}`);
    open = undefined;
    log(`Claim paid to ${payee.name} ${explorer(await send(agent, [ix.executeClaim(ctx, {
      estate, payer: A("agent"), rule: new PublicKey(claimRule.address), claim, payeeWallet: new PublicKey(payee.wallet),
    })]))}`);
  } else log(claimRule ? "A paid claim already exists" : "No starts-now claim rule found");

  // 3. Vault top-up.
  log(`Vault top-up 500 USD₮ ${explorer(await send(dad, [ix.deposit(ctx, A("dad"), toBase(500))]))}`);

  // 4. Pocket money: dad → Lerato, a plain USD₮ transfer signed by the dad's WDK wallet.
  const mint = new PublicKey(w.usdtMint);
  const from = getAssociatedTokenAddressSync(mint, A("dad")), to = getAssociatedTokenAddressSync(mint, A("lerato"));
  log(`Dad sent 50 USD₮ to Lerato ${explorer(await send(dad, [
    createAssociatedTokenAccountIdempotentInstruction(A("dad"), to, A("lerato"), mint),
    createTransferCheckedInstruction(from, mint, to, A("dad"), toBase(50), 6),
  ]))}`);

  s = await snap();
  console.log(`\nDone. Claims: ${s.claims.length}; vault and activity update in the app.`);
}

main().then(() => disposeAll()).catch((e) => { console.error(e instanceof Error ? e.message : e); disposeAll(); process.exit(1); });
