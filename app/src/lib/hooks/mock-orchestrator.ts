/**
 * Offline stand-in for POST /api/agent/orchestrate: routes a message to a "specialist" by intent
 * and answers from the estate snapshot on this device. Reply wording comes from content/assistant.ts.
 */
import { formatUsdt, formatZar } from "../format";
import type { EstateSnapshot } from "../service";
import type { FxRate, Role } from "../types";
import type { AssistantCopy } from "@/content/assistant";
import type { AgentAction, OrchestratorReply } from "./agent-types";

export interface OrchestratorContext { role: Role | null; address: string | null; snap: EstateSnapshot | null; fx: FxRate | null }

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ""));

export function mockOrchestrate(text: string, ctx: OrchestratorContext, copy: AssistantCopy): OrchestratorReply {
  const q = text.toLowerCase();
  const f = copy.flows;
  const { snap, role, address } = ctx;
  const rate = ctx.fx?.usdtZar ?? 0;
  const zar = (b: bigint) => (rate ? formatZar(b, rate) : "");
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const out = (specialist: OrchestratorReply["specialist"], reply: string, actions: AgentAction[] = []): OrchestratorReply => ({ specialist, reply, actions });

  if (has("legal", "popia", "privacy", "valid", "law", "wills act", "lawyer")) return out("Compliance", f.compliance, [{ type: "navigate", to: "/privacy" }]);
  if (has("drain", "steal", "safe", "fraud", "fake", "trust you", "stops someone")) return out("Compliance", f.safety, snap ? [{ type: "navigate", to: "/people" }] : []);

  if (!snap) {
    if (has("will", "write", "wish", "start") && role === "owner") return out("WillWriter", f.willNew, [{ type: "navigate", to: "/will" }]);
    return out("EstateGuide", f.noEstate, role === "owner" ? [{ type: "navigate", to: "/will" }] : []);
  }

  const e = snap.estate;
  const car = snap.assets[0];
  const status = copy.statusWords[e.status];

  if (has("schedul", "allowance", "start paying", "monthly", "every month", "living", "recurring", "now")) {
    const sched = snap.rules.filter((r) => r.recurringAmount > BigInt(0));
    if (!sched.length) return out("EstateGuide", f.scheduledNone, [{ type: "navigate", to: role === "owner" ? "/will" : "/estate" }]);
    const next = [...sched].filter((r) => r.nextDue !== null).sort((a, b) => (a.nextDue ?? 0) - (b.nextDue ?? 0))[0] ?? sched[0];
    return out("EstateGuide", fill(f.scheduled, {
      count: sched.length === 1 ? copy.scheduleCountOne : fill(copy.scheduleCountMany, { n: sched.length }),
      next: fill(copy.scheduleNext, { amount: formatUsdt(next.recurringAmount, { decimals: 0 }), payee: snap.payees.find((p) => p.wallet === next.fixedPayee)?.name ?? "" }),
    }), [{ type: "showRule", rule: next.address }, { type: "navigate", to: "/estate" }]);
  }

  if (has("escrow", "win", "what do i get")) return out("CarBroker", f.escrow, [{ type: "navigate", to: "/car" }]);

  if (has("car", "corolla", "vehicle", "offer", "floor", "minimum price", "sell", "less")) {
    if (!car) return out("CarBroker", f.carNone, [{ type: "navigate", to: "/car" }]);
    const offers = snap.offers.filter((o) => o.asset === car.address);
    const best = offers.reduce<bigint | null>((m, o) => (m === null || o.amount > m ? o.amount : m), null);
    const vars = {
      title: car.title, floor: formatUsdt(car.floorPrice, { decimals: 0 }), floorZar: zar(car.floorPrice), asking: formatUsdt(car.askingPrice, { decimals: 0 }),
      hardshipFloor: formatUsdt(car.hardshipFloor, { decimals: 0 }),
      offerCount: offers.length === 1 ? copy.offerCountOne : fill(copy.offerCountMany, { n: offers.length }),
      best: best === null ? copy.noOffers : formatUsdt(best, { decimals: 0 }),
    };
    const base = fill(car.status === "Sold" ? f.carSold : car.status === "Listed" ? f.carListed : f.carHeld, vars);
    const actions: AgentAction[] = [{ type: "navigate", to: "/car" }];
    if (has("less", "hardship", "need") && role === "beneficiary" && car.status !== "Sold") {
      actions.push({ type: "startUpload", purpose: "hardship" });
      return out("CarBroker", `${base}\n\n${f.carHardship}`, actions);
    }
    return out("CarBroker", base, actions);
  }

  if (has("passed", "passing", "death", "died", "certificate", "report", "confirming", "still here", "alive")) {
    if (role === "owner") return out("EstateGuide", f.deathOwner, [{ type: "navigate", to: "/family" }]);
    if (role === "verifier") return out("DocumentReviewer", f.deathVerifier, [{ type: "navigate", to: "/inbox" }]);
    const wait = e.waitingPeriodSecs >= 86400 ? `${Math.round(e.waitingPeriodSecs / 86400)} days` : `${e.waitingPeriodSecs} seconds in this demo`;
    const actions: AgentAction[] = e.status === "Active" && role === "beneficiary" ? [{ type: "startUpload", purpose: "death" }] : [{ type: "navigate", to: "/family" }];
    return out("DocumentReviewer", fill(f.deathFamily, { v1: e.verifierNames[0], v2: e.verifierNames[1], v3: e.verifierNames[2], wait }), actions);
  }

  if (has("claim", "fee", "tuition", "rent", "pay", "approves")) {
    if (role !== "beneficiary") return out("ClaimsGuide", f.claimNotYours, role === "verifier" ? [{ type: "navigate", to: "/inbox" }] : [{ type: "navigate", to: "/estate" }]);
    const mineRules = snap.rules.filter((r) => r.beneficiary === address && r.recurringAmount === BigInt(0));
    const rule = mineRules.find((r) => r.startsNow || e.status === "Unlocked") ?? mineRules[0];
    if (!rule) return out("ClaimsGuide", f.claimNoRule, [{ type: "navigate", to: "/estate" }]);
    if (e.status !== "Unlocked" && !(rule.startsNow && e.status === "Active")) return out("ClaimsGuide", fill(f.claimLocked, { status }), [e.status === "Active" ? { type: "startUpload", purpose: "death" } : { type: "navigate", to: "/family" }]);
    const payee = snap.payees.find((p) => p.kind === rule.allowedPayeeKind);
    return out("ClaimsGuide", fill(f.claimReady, {
      category: rule.category.toLowerCase(), max: formatUsdt(rule.maxPerClaim, { decimals: 0 }),
      left: formatUsdt(rule.lifetimeCap - rule.spentTotal, { decimals: 0 }), payeeKind: rule.allowedPayeeKind.toLowerCase(),
    }), [{ type: "openClaimForm", rule: rule.address, payee: payee?.wallet }, { type: "showRule", rule: rule.address }]);
  }

  if (has("waiting for me", "inbox", "approve")) {
    const n = (e.death.certHash && e.death.verdict === "Approved" && e.status === "Active" ? 1 : 0)
      + snap.claims.filter((c) => c.status === "Open").length + snap.hardships.filter((h) => h.status === "Open").length;
    return out("EstateGuide", n ? fill(f.inbox, { count: n === 1 ? copy.inboxCountOne : fill(copy.inboxCountMany, { n }) }) : f.inboxEmpty, [{ type: "navigate", to: "/inbox" }]);
  }

  if (has("will", "rule", "write", "wish")) {
    if (role !== "owner") return out("EstateGuide", f.willOther, [{ type: "navigate", to: "/estate" }]);
    return out("WillWriter", fill(f.willDone, { rules: snap.rules.length, children: snap.beneficiaries.length }), [{ type: "navigate", to: "/estate" }]);
  }

  if (has("vault", "balance", "money", "how much", "deposit", "fund")) {
    return out("EstateGuide", fill(f.vault, {
      vault: formatUsdt(e.vaultBalance), vaultZar: zar(e.vaultBalance), fxSource: ctx.fx?.source ?? "",
      vaultNote: role === "owner" && e.status === "Active" ? f.vaultOwnerNote : f.vaultOtherNote,
    }), [{ type: "navigate", to: role === "owner" ? "/vault" : "/estate" }]);
  }

  return out("EstateGuide", fill(f.summary, {
    owner: e.ownerName, status, vault: formatUsdt(e.vaultBalance), vaultZar: zar(e.vaultBalance), rules: snap.rules.length, children: snap.beneficiaries.length,
    next: e.status === "Unlocked" ? f.nextUnlocked : e.status === "DeathPending" ? f.nextPending : f.nextActive,
  }), [{ type: "navigate", to: "/estate" }]);
}
