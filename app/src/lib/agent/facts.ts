/**
 * EstateFacts: a compact, JSON-safe, personal-data-free view of an EstateSnapshot that the UI (or the server
 * in chain mode) hands to the orchestrator's specialists as tool data. Client-safe.
 */
import { z } from "zod";
import type { EstateSnapshot } from "../service/types";
import { fromBase } from "../format";

export const estateFactsSchema = z.object({
  estate: z.object({
    address: z.string(), status: z.string(), ownerName: z.string(), vaultUsdt: z.number(),
    waitingPeriodSecs: z.number(), deathThreshold: z.number(), claimThreshold: z.number(), hardshipThreshold: z.number(),
    death: z.object({ verdict: z.string(), attestations: z.number(), pendingSince: z.number().nullable() }),
  }),
  beneficiaries: z.array(z.object({ wallet: z.string(), label: z.string() })).max(20),
  payees: z.array(z.object({ wallet: z.string(), name: z.string(), kind: z.string() })).max(30),
  rules: z.array(z.object({
    address: z.string(), id: z.number(), beneficiary: z.string(), beneficiaryLabel: z.string(), category: z.string(),
    allowedPayeeKind: z.string(), maxPerClaimUsdt: z.number(), lifetimeCapUsdt: z.number(), spentUsdt: z.number(),
    remainingUsdt: z.number(), validUntil: z.number(),
  })).max(30),
  claims: z.array(z.object({
    address: z.string(), rule: z.string(), amountUsdt: z.number(), status: z.string(), agentVerdict: z.string(),
    approvals: z.number(), redFlags: z.array(z.string()).optional(),
  })).max(20),
  asset: z.object({
    address: z.string(), title: z.string(), status: z.string(), floorUsdt: z.number(), hardshipFloorUsdt: z.number(),
    askingUsdt: z.number(), hardshipApproved: z.boolean(), listingEnds: z.number().nullable(),
  }).nullable(),
  offers: z.array(z.object({ address: z.string(), buyer: z.string(), amountUsdt: z.number(), createdAt: z.number() })).max(30),
  hardships: z.array(z.object({ address: z.string(), status: z.string(), agentVerdict: z.string(), approvals: z.number() })).max(10),
  recentActivity: z.array(z.string()).max(10),
});
export type EstateFacts = z.infer<typeof estateFactsSchema>;

const count = (b: boolean[]) => b.filter(Boolean).length;

export function toEstateFacts(s: EstateSnapshot): EstateFacts {
  const label = (w: string) => s.beneficiaries.find((b) => b.wallet === w)?.label ?? w.slice(0, 6);
  const a = s.assets[0];
  return {
    estate: {
      address: s.estate.address, status: s.estate.status, ownerName: s.estate.ownerName, vaultUsdt: fromBase(s.estate.vaultBalance),
      waitingPeriodSecs: s.estate.waitingPeriodSecs, deathThreshold: s.estate.deathThreshold,
      claimThreshold: s.estate.claimThreshold, hardshipThreshold: s.estate.hardshipThreshold,
      death: { verdict: s.estate.death.verdict, attestations: count(s.estate.death.attestations), pendingSince: s.estate.death.pendingSince },
    },
    beneficiaries: s.beneficiaries.map((b) => ({ wallet: b.wallet, label: b.label })),
    payees: s.payees.map((p) => ({ wallet: p.wallet, name: p.name, kind: p.kind })),
    rules: s.rules.map((r) => ({
      address: r.address, id: r.id, beneficiary: r.beneficiary, beneficiaryLabel: label(r.beneficiary), category: r.category,
      allowedPayeeKind: r.allowedPayeeKind, maxPerClaimUsdt: fromBase(r.maxPerClaim), lifetimeCapUsdt: fromBase(r.lifetimeCap),
      spentUsdt: fromBase(r.spentTotal), remainingUsdt: fromBase(r.lifetimeCap - r.spentTotal), validUntil: r.validUntil,
    })),
    claims: s.claims.slice(0, 20).map((c) => ({
      address: c.address, rule: c.rule, amountUsdt: fromBase(c.amount), status: c.status, agentVerdict: c.agentVerdict,
      approvals: count(c.approvals), redFlags: c.agentReport?.redFlags,
    })),
    asset: a ? {
      address: a.address, title: a.title, status: a.status, floorUsdt: fromBase(a.floorPrice), hardshipFloorUsdt: fromBase(a.hardshipFloor),
      askingUsdt: fromBase(a.askingPrice), hardshipApproved: a.hardshipBeneficiary !== null, listingEnds: a.listingEnds,
    } : null,
    offers: s.offers.map((o) => ({ address: o.address, buyer: o.buyerName ?? o.buyer.slice(0, 6), amountUsdt: fromBase(o.amount), createdAt: o.createdAt })),
    hardships: s.hardships.map((h) => ({ address: h.address, status: h.status, agentVerdict: h.agentVerdict, approvals: count(h.approvals) })),
    recentActivity: s.activity.slice(0, 10).map((x) => x.text),
  };
}

/** Deterministic claim pre-check (mirrors submit_claim's on-chain checks). Pure; unit-tested. */
export function checkClaim(facts: EstateFacts, ruleId: number, amountUsdt: number, payeeWallet?: string, nowSecs = Math.floor(Date.now() / 1000)):
  { ok: boolean; problems: string[]; maxAllowedUsdt: number } {
  const rule = facts.rules.find((r) => r.id === ruleId);
  if (!rule) return { ok: false, problems: [`There is no rule #${ruleId}.`], maxAllowedUsdt: 0 };
  const problems: string[] = [];
  const maxAllowed = Math.max(0, Math.min(rule.maxPerClaimUsdt, rule.remainingUsdt));
  if (facts.estate.status !== "Unlocked") problems.push(`The estate is ${facts.estate.status}; claims open only once it is Unlocked.`);
  if (amountUsdt <= 0) problems.push("The amount must be more than zero.");
  if (amountUsdt > rule.maxPerClaimUsdt) problems.push(`The per-claim cap is ${rule.maxPerClaimUsdt} USD₮.`);
  if (amountUsdt > rule.remainingUsdt) problems.push(`Only ${rule.remainingUsdt} USD₮ is left under the lifetime cap.`);
  if (nowSecs > rule.validUntil) problems.push("This rule has expired.");
  if (payeeWallet) {
    const payee = facts.payees.find((p) => p.wallet === payeeWallet);
    if (!payee) problems.push("That payee is not approved for this estate.");
    else if (payee.kind !== rule.allowedPayeeKind) problems.push(`This rule only pays a ${rule.allowedPayeeKind}, not a ${payee.kind}.`);
  }
  return { ok: problems.length === 0, problems, maxAllowedUsdt: maxAllowed };
}
