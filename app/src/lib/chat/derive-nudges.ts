/**
 * Pure derivation of "needs your attention" nudges from the estate snapshot and who is acting.
 * Ids are stable per underlying item (and per occurrence, e.g. each due date), so a dismissal sticks until
 * something new happens. The hook in ./nudges.ts adds dismissals and persistence.
 */
import { formatUsdt, formatZar } from "@/lib/format";
import type { EstateSnapshot } from "@/lib/service";
import type { Base58, Role, Rule } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import { chatCopy, fill } from "./nudge-copy";
import type { Nudge, NudgeKind } from "./types";

export const DAY = 86400;
/** The owner is nudged to check in after this long without a heartbeat. */
export const HEARTBEAT_AFTER_SECS = 30 * DAY;
/** How far ahead scheduled payments count against the vault balance. */
export const VAULT_HORIZON_SECS = 30 * DAY;

export interface LegacyHint {
  /** What the children call the parent ("Dad"). */
  calledBy: string;
  /** The child's "first fees" milestone messages (their own and "all"). Empty = none recorded. */
  milestones: { id: string; title: string }[];
}

export interface NudgeOptions {
  /** Wallet of the person acting (needed for verifier / beneficiary nudges). */
  address?: Base58 | null;
  /** USD₮→ZAR rate, for the rand equivalent. */
  usdtZar?: number | null;
  locale?: Locale;
  /** Legacy Book info for a child, when loaded. Undefined = unknown (a generic message nudge is shown). */
  legacy?: LegacyHint | null;
}

const URGENCY_RANK: Record<Nudge["urgency"], number> = { now: 0, soon: 1, info: 2 };
const KIND_RANK: Record<NudgeKind, number> = {
  "death-to-confirm": 0, "unlock-ready": 1, "claim-to-approve": 2, "scheduled-due": 3, "hardship-to-review": 4,
  "offer-received": 5, heartbeat: 6, "fund-vault": 7, "legacy-message": 8,
};

/** Most urgent first; then by kind; then by id so the order never flickers. */
export function sortNudges(list: Nudge[]): Nudge[] {
  return [...list].sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.id.localeCompare(b.id));
}

const count = (a: boolean[]) => a.filter(Boolean).length;

/** A schedule that is allowed to pay right now (living plan while active, any after unlock), within its limits. */
function scheduleLive(snap: EstateSnapshot, r: Rule, now: number): boolean {
  const st = snap.estate.status;
  return r.recurringAmount > BigInt(0) && !!r.fixedPayee && r.nextDue !== null
    && (st === "Unlocked" || (r.startsNow && st === "Active"))
    && now <= r.validUntil && r.spentTotal + r.recurringAmount <= r.lifetimeCap;
}

/** Total of scheduled payments due between now and `now + horizon` (including overdue ones), within each rule's caps. */
export function upcomingScheduled(snap: EstateSnapshot, now: number, horizon = VAULT_HORIZON_SECS): bigint {
  let total = BigInt(0);
  const end = now + horizon;
  for (const r of snap.rules) {
    if (!scheduleLive(snap, r, now) || r.nextDue === null || r.nextDue > end) continue;
    const span = Math.min(end, r.validUntil) - r.nextDue;
    let n = r.intervalSecs > 0 ? Math.floor(Math.max(0, span) / r.intervalSecs) + 1 : 1;
    const left = r.lifetimeCap - r.spentTotal;
    const affordable = Number(left / r.recurringAmount);
    n = Math.min(n, affordable);
    total += r.recurringAmount * BigInt(Math.max(0, n));
  }
  return total;
}

export function deriveNudges(snap: EstateSnapshot | null, role: Role | null, now: number, opts: NudgeOptions = {}): Nudge[] {
  if (!snap || !role) return [];
  const c = chatCopy(opts.locale).nudges;
  const e = snap.estate;
  const me = opts.address ?? null;
  const rate = opts.usdtZar ?? null;
  const usd = (b: bigint) => formatUsdt(b, { decimals: 0 });
  const zar = (b: bigint) => (rate ? ` · ${formatZar(b, rate)}` : "");
  const firstName = (label: string) => label.split(/[ (]/)[0] || label;
  const personName = (wallet: Base58 | null) => {
    const b = snap.beneficiaries.find((x) => x.wallet === wallet);
    return b ? firstName(b.label) : c.someone;
  };
  const payeeName = (wallet: Base58 | null) => snap.payees.find((p) => p.wallet === wallet)?.name ?? c.institution;
  const owner = firstName(e.ownerName);
  const vIndex = me ? e.verifiers.indexOf(me) : -1;
  const isVerifier = role === "verifier" && vIndex >= 0;
  const dismiss = { label: c.dismiss, dismiss: true as const };
  const out: Nudge[] = [];
  const push = (n: Omit<Nudge, "secondary">) => out.push({ ...n, secondary: dismiss });

  // Scheduled payments due now: anyone may trigger them (owner, the child it's for, a trusted person, the agent).
  if (role !== "buyer") {
    for (const r of snap.rules) {
      if (!scheduleLive(snap, r, now) || r.nextDue === null || r.nextDue > now) continue;
      if (role === "beneficiary" && r.beneficiary !== me) continue;
      push({
        id: `scheduled-due:${r.address}:${r.nextDue}`, kind: "scheduled-due", urgency: "now",
        title: c.scheduledDue.title,
        body: fill(c.scheduledDue.body, { name: personName(r.beneficiary), category: r.category.toLowerCase(), amount: usd(r.recurringAmount), zar: zar(r.recurringAmount), payee: payeeName(r.fixedPayee) }),
        primary: { label: c.scheduledDue.cta, action: { type: "run", op: "executeScheduled", target: r.address } },
      });
    }
  }

  // Claims: the owner approves living-plan claims while alive; after unlock a trusted person does.
  for (const cl of snap.claims) {
    if (cl.status !== "Open" || cl.agentVerdict !== "Approved" || cl.ownerApproved) continue;
    const rule = snap.rules.find((r) => r.address === cl.rule);
    const vars = { name: personName(cl.beneficiary), amount: usd(cl.amount), zar: zar(cl.amount), payee: payeeName(cl.payee) };
    if (role === "owner" && e.status === "Active" && rule?.startsNow) {
      push({ id: `claim:${cl.address}`, kind: "claim-to-approve", urgency: "now", title: c.claimOwner.title, body: fill(c.claimOwner.body, vars), primary: { label: c.claimOwner.cta, action: { type: "navigate", to: "/claims" } } });
    } else if (isVerifier && e.status === "Unlocked" && !cl.approvals[vIndex] && count(cl.approvals) < e.claimThreshold) {
      push({ id: `claim:${cl.address}`, kind: "claim-to-approve", urgency: "now", title: c.claimVerifier.title, body: fill(c.claimVerifier.body, vars), primary: { label: c.claimVerifier.cta, action: { type: "navigate", to: "/inbox" } } });
    }
  }

  // A reported passing.
  const d = e.death;
  if (isVerifier && e.status === "Active" && d.certHash && d.verdict === "Approved" && !d.attestations[vIndex]) {
    push({
      id: `death:${d.certHash}`, kind: "death-to-confirm", urgency: "now", title: c.deathToConfirm.title,
      body: fill(c.deathToConfirm.body, { name: personName(d.submittedBy), owner }),
      primary: { label: c.deathToConfirm.cta, action: { type: "navigate", to: "/inbox" } },
    });
  }
  if (role === "owner" && d.certHash && (e.status === "Active" || e.status === "DeathPending")) {
    push({
      id: `death-reported:${d.certHash}`, kind: "heartbeat", urgency: "now", title: c.deathReported.title, body: c.deathReported.body,
      primary: { label: c.deathReported.cta, action: { type: "navigate", to: "/family" } },
    });
  }

  // Waiting period over: anyone can finalise the unlock.
  if (e.status === "DeathPending" && d.pendingSince !== null && now >= d.pendingSince + e.waitingPeriodSecs && role !== "owner" && role !== "buyer") {
    push({
      id: `unlock:${e.address}:${d.pendingSince}`, kind: "unlock-ready", urgency: "now", title: c.unlockReady.title,
      body: fill(c.unlockReady.body, { owner }),
      primary: { label: c.unlockReady.cta, action: { type: "run", op: "finalizeUnlock", target: e.address } },
    });
  }

  // Hardship requests for a trusted person.
  if (isVerifier) {
    for (const h of snap.hardships) {
      if (h.status !== "Open" || h.agentVerdict !== "Approved" || h.approvals[vIndex]) continue;
      push({
        id: `hardship:${h.address}`, kind: "hardship-to-review", urgency: "soon", title: c.hardshipToReview.title,
        body: fill(c.hardshipToReview.body, { name: personName(h.beneficiary) }),
        primary: { label: c.hardshipToReview.cta, action: { type: "navigate", to: "/inbox" } },
      });
    }
  }

  // Car offers the agent or a trusted person can settle.
  if (role === "agent" || isVerifier) {
    for (const a of snap.assets) {
      if (a.status !== "Listed") continue;
      const min = a.hardshipBeneficiary ? a.hardshipFloor : a.floorPrice;
      const best = snap.offers.filter((o) => o.asset === a.address && o.amount >= min)
        .sort((x, y) => (y.amount > x.amount ? 1 : y.amount < x.amount ? -1 : x.createdAt - y.createdAt))[0];
      if (!best) continue;
      const ended = a.listingEnds !== null && now >= a.listingEnds;
      push({
        id: `offer:${a.address}:${best.address}`, kind: "offer-received", urgency: ended ? "now" : "soon", title: c.offerReceived.title,
        body: fill(ended ? c.offerReceived.bodyEnded : c.offerReceived.body, { title: a.title, amount: usd(best.amount), zar: zar(best.amount) }),
        primary: { label: c.offerReceived.cta, action: { type: "navigate", to: "/car" } },
      });
    }
  }

  // A legacy message tied to a milestone: the child's first fees paid after unlock.
  if (role === "beneficiary" && e.status === "Unlocked" && opts.legacy !== null) {
    const feesPaid = snap.claims.some((cl) => cl.beneficiary === me && cl.status === "Paid"
      && snap.rules.find((r) => r.address === cl.rule)?.category === "Tuition");
    if (feesPaid) {
      const calledBy = opts.legacy?.calledBy || "Dad";
      const list = opts.legacy ? opts.legacy.milestones : [{ id: "first-fees", title: "" }];
      for (const m of list) {
        push({
          id: `legacy:${m.id}`, kind: "legacy-message", urgency: "info", title: fill(c.legacyMessage.title, { calledBy }),
          body: fill(m.title ? c.legacyMessage.body : c.legacyMessage.bodyGeneric, { calledBy, milestone: m.title }),
          primary: { label: c.legacyMessage.cta, action: { type: "navigate", to: "/legacy" } },
        });
      }
    }
  }

  // The owner's check-in and the vault's runway.
  if (role === "owner" && e.status === "Active") {
    if (!d.certHash && now - e.lastHeartbeat >= HEARTBEAT_AFTER_SECS) {
      const never = e.lastHeartbeat <= 0;
      push({
        id: `heartbeat:${e.lastHeartbeat}`, kind: "heartbeat", urgency: "soon", title: c.heartbeat.title,
        body: never ? c.heartbeat.bodyNever : fill(c.heartbeat.body, { days: Math.floor((now - e.lastHeartbeat) / DAY) }),
        primary: { label: c.heartbeat.cta, action: { type: "navigate", to: "/vault" } },
      });
    }
    const due = upcomingScheduled(snap, now);
    if (due > e.vaultBalance) {
      const dueNow = snap.rules.some((r) => scheduleLive(snap, r, now) && r.nextDue !== null && r.nextDue <= now && r.recurringAmount > e.vaultBalance);
      push({
        id: `fund-vault:${due.toString()}`, kind: "fund-vault", urgency: dueNow ? "now" : "soon", title: c.fundVault.title,
        body: fill(c.fundVault.body, { vault: usd(e.vaultBalance), due: usd(due), zar: zar(due) }),
        primary: { label: c.fundVault.cta, action: { type: "navigate", to: "/vault" } },
      });
    }
  }

  return sortNudges(out);
}

/** Drops dismissed nudges. */
export function visibleNudges(list: Nudge[], dismissed: ReadonlySet<string> | readonly string[]): Nudge[] {
  const set = dismissed instanceof Set ? dismissed : new Set(dismissed as readonly string[]);
  return list.filter((n) => !set.has(n.id));
}

/* ---------- dismissals, per persona ---------- */

const DISMISS_PREFIX = "heirloom.nudges.dismissed.v1.";
const MAX_DISMISSED = 200;
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const dismissKey = (persona: string) => `${DISMISS_PREFIX}${persona || "guest"}`;

export function loadDismissed(storage: StorageLike | null, persona: string): string[] {
  try {
    const raw = storage?.getItem(dismissKey(persona));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(-MAX_DISMISSED) : [];
  } catch {
    return [];
  }
}

export function saveDismissed(storage: StorageLike | null, persona: string, ids: readonly string[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(dismissKey(persona), JSON.stringify([...new Set(ids)].slice(-MAX_DISMISSED)));
    return true;
  } catch {
    return false;
  }
}
