import { describe, expect, it, vi } from "vitest";
import { toBase } from "@/lib/format";
import type { EstateSnapshot } from "@/lib/service";
import type { AgentReport, Claim, Rule } from "@/lib/types";
import { assistant } from "@/content/assistant";
import {
  DAY, deriveNudges, dismissKey, loadDismissed, saveDismissed, sortNudges, upcomingScheduled, visibleNudges,
} from "./derive-nudges";
import {
  MAX_MESSAGES, MAX_THREADS, NEW_CHAT_TITLE, capState, deriveTitle, emptyThreadState, loadThreads, saveThreads,
  storageKey, threadReducer, type ThreadState,
} from "./thread-store";
import { attachmentReply, reviewPurpose, suggestionsFor } from "./attachment";
import { chatCopy } from "./nudge-copy";
import { runAssistantTurn, turnText } from "./pipeline";
import type { Nudge } from "./types";

/* ---------- fixtures ---------- */

const NOW = 1_800_000_000;
const OWNER = "OwnerWallet111111111111111111111111111111111";
const LERATO = "LeratoWallet11111111111111111111111111111111";
const V = ["Verifier0Wallet111111111111111111111111111111", "Verifier1Wallet111111111111111111111111111111", "Verifier2Wallet111111111111111111111111111111"] as const;
const UCT = "UctWallet1111111111111111111111111111111111";
const ESTATE = "EstateAddr11111111111111111111111111111111";

function rule(over: Partial<Rule> = {}): Rule {
  return {
    address: "RuleTuition", id: 0, beneficiary: LERATO, category: "Tuition", allowedPayeeKind: "University",
    maxPerClaim: toBase(5000), lifetimeCap: toBase(20000), spentTotal: BigInt(0), validUntil: NOW + 365 * DAY,
    startsNow: false, recurringAmount: BigInt(0), intervalSecs: 0, nextDue: null, fixedPayee: null, ...over,
  };
}
const books = (over: Partial<Rule> = {}) => rule({
  address: "RuleBooks", id: 1, category: "Books", startsNow: true, recurringAmount: toBase(85), intervalSecs: 30 * DAY,
  nextDue: NOW - 10, fixedPayee: UCT, lifetimeCap: toBase(2000), ...over,
});
function claim(over: Partial<Claim> = {}): Claim {
  return {
    address: "Claim1", rule: "RuleTuition", id: 0, beneficiary: LERATO, payee: UCT, amount: toBase(3000), evidenceHash: "h",
    agentVerdict: "Approved", approvals: [false, false, false], ownerApproved: false, status: "Open", createdAt: NOW - 100, ...over,
  };
}
function snapshot(over: { estate?: Partial<EstateSnapshot["estate"]> } & Partial<Omit<EstateSnapshot, "estate">> = {}): EstateSnapshot {
  const { estate, ...rest } = over;
  return {
    estate: {
      address: ESTATE, owner: OWNER, ownerName: "Thabo Mokoena", agent: "Agent", usdtMint: "Mint",
      verifiers: [...V], verifierNames: ["A", "B", "C"], deathThreshold: 2, claimThreshold: 1, hardshipThreshold: 2,
      waitingPeriodSecs: 60, status: "Active", willHash: null, vaultBalance: toBase(10000), lastHeartbeat: NOW - DAY,
      death: { certHash: null, submittedBy: null, verdict: "Pending", attestations: [false, false, false], pendingSince: null },
      ...estate,
    },
    beneficiaries: [{ address: "B1", wallet: LERATO, label: "Lerato (daughter)", active: true }],
    payees: [{ address: "P1", wallet: UCT, kind: "University", name: "University of Cape Town" }],
    rules: [rule()], claims: [], assets: [], offers: [], hardships: [], activity: [],
    ...rest,
  };
}
const kinds = (n: Nudge[]) => n.map((x) => x.kind);

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

/* ---------- nudges ---------- */

describe("deriveNudges", () => {
  it("returns nothing without a snapshot or role", () => {
    expect(deriveNudges(null, "owner", NOW)).toEqual([]);
    expect(deriveNudges(snapshot(), null, NOW)).toEqual([]);
  });

  it("scheduled-due: a due living-plan payment, with the rand equivalent and a run action", () => {
    const snap = snapshot({ rules: [rule(), books()] });
    const [n] = deriveNudges(snap, "owner", NOW, { usdtZar: 18 }).filter((x) => x.kind === "scheduled-due");
    expect(n.id).toBe(`scheduled-due:RuleBooks:${NOW - 10}`);
    expect(n.body).toContain("Lerato's books payment (85 USD₮ · R 1");
    expect(n.body).toContain("University of Cape Town");
    expect(n.primary.action).toEqual({ type: "run", op: "executeScheduled", target: "RuleBooks" });
    expect(n.urgency).toBe("now");
    expect(n.secondary).toEqual({ label: chatCopy().nudges.dismiss, dismiss: true });
  });

  it("scheduled-due: not before it's due, not for another child, not for a buyer, not paused during a death report", () => {
    expect(kinds(deriveNudges(snapshot({ rules: [books({ nextDue: NOW + 10 })] }), "owner", NOW))).not.toContain("scheduled-due");
    expect(kinds(deriveNudges(snapshot({ rules: [books()] }), "beneficiary", NOW, { address: "someone-else" }))).not.toContain("scheduled-due");
    expect(kinds(deriveNudges(snapshot({ rules: [books()] }), "beneficiary", NOW, { address: LERATO }))).toContain("scheduled-due");
    expect(kinds(deriveNudges(snapshot({ rules: [books()] }), "buyer", NOW))).not.toContain("scheduled-due");
    expect(kinds(deriveNudges(snapshot({ rules: [books()], estate: { status: "DeathPending" } }), "verifier", NOW, { address: V[0] }))).not.toContain("scheduled-due");
    expect(kinds(deriveNudges(snapshot({ rules: [books({ spentTotal: toBase(2000) })] }), "owner", NOW))).not.toContain("scheduled-due");
  });

  it("claim-to-approve: owner for living-plan claims while active", () => {
    const snap = snapshot({ rules: [rule({ startsNow: true })], claims: [claim()] });
    const n = deriveNudges(snap, "owner", NOW).find((x) => x.kind === "claim-to-approve")!;
    expect(n.id).toBe("claim:Claim1");
    expect(n.primary.action).toEqual({ type: "navigate", to: "/claims" });
    // Not a living-plan rule, or already approved: nothing for the owner.
    expect(kinds(deriveNudges(snapshot({ claims: [claim()] }), "owner", NOW))).not.toContain("claim-to-approve");
    expect(kinds(deriveNudges(snapshot({ rules: [rule({ startsNow: true })], claims: [claim({ ownerApproved: true })] }), "owner", NOW))).not.toContain("claim-to-approve");
  });

  it("claim-to-approve: verifier after unlock until the threshold is met", () => {
    const base = { estate: { status: "Unlocked" as const }, claims: [claim()] };
    expect(kinds(deriveNudges(snapshot(base), "verifier", NOW, { address: V[1] }))).toContain("claim-to-approve");
    expect(kinds(deriveNudges(snapshot(base), "verifier", NOW, { address: "not-a-verifier" }))).not.toContain("claim-to-approve");
    expect(kinds(deriveNudges(snapshot({ ...base, claims: [claim({ approvals: [true, false, false] })] }), "verifier", NOW, { address: V[1] }))).not.toContain("claim-to-approve");
    expect(kinds(deriveNudges(snapshot({ ...base, claims: [claim({ agentVerdict: "Rejected" })] }), "verifier", NOW, { address: V[1] }))).not.toContain("claim-to-approve");
  });

  it("death-to-confirm: verifier who hasn't attested; owner sees a still-here nudge", () => {
    const death = { certHash: "cert1", submittedBy: LERATO, verdict: "Approved" as const, attestations: [true, false, false], pendingSince: null };
    const snap = snapshot({ estate: { death } });
    const n = deriveNudges(snap, "verifier", NOW, { address: V[1] }).find((x) => x.kind === "death-to-confirm")!;
    expect(n.id).toBe("death:cert1");
    expect(n.body).toContain("Lerato reported that Thabo");
    expect(kinds(deriveNudges(snap, "verifier", NOW, { address: V[0] }))).not.toContain("death-to-confirm");
    const owner = deriveNudges(snap, "owner", NOW);
    expect(owner[0]).toMatchObject({ id: "death-reported:cert1", kind: "heartbeat", urgency: "now" });
  });

  it("unlock-ready: only once the waiting period is over", () => {
    const pending = (since: number) => snapshot({ estate: { status: "DeathPending", death: { certHash: "c", submittedBy: LERATO, verdict: "Approved", attestations: [true, true, false], pendingSince: since } } });
    expect(kinds(deriveNudges(pending(NOW - 30), "beneficiary", NOW, { address: LERATO }))).not.toContain("unlock-ready");
    const n = deriveNudges(pending(NOW - 61), "beneficiary", NOW, { address: LERATO }).find((x) => x.kind === "unlock-ready")!;
    expect(n.primary.action).toEqual({ type: "run", op: "finalizeUnlock", target: ESTATE });
    expect(n.id).toBe(`unlock:${ESTATE}:${NOW - 61}`);
  });

  it("hardship-to-review: verifier who hasn't approved", () => {
    const h = { address: "H1", asset: "A1", beneficiary: LERATO, evidenceHash: "e", agentVerdict: "Approved" as const, approvals: [false, false, false], status: "Open" as const };
    const snap = snapshot({ estate: { status: "Unlocked" }, hardships: [h] });
    expect(deriveNudges(snap, "verifier", NOW, { address: V[2] }).find((x) => x.kind === "hardship-to-review")?.id).toBe("hardship:H1");
    expect(kinds(deriveNudges(snapshot({ estate: { status: "Unlocked" }, hardships: [{ ...h, approvals: [false, false, true] }] }), "verifier", NOW, { address: V[2] }))).not.toContain("hardship-to-review");
  });

  it("offer-received: agent/verifier with an offer at or above the minimum; urgent once the listing ends", () => {
    const asset = { address: "A1", nftMint: "m", title: "2019 Corolla", floorPrice: toBase(10000), hardshipFloor: toBase(8000), askingPrice: toBase(11000), proceedsTo: ESTATE, status: "Listed" as const, listingEnds: NOW + 100, docHash: "d", hardshipBeneficiary: null };
    const offers = [
      { address: "O1", asset: "A1", buyer: "b1", amount: toBase(9300), createdAt: NOW - 50 },
      { address: "O2", asset: "A1", buyer: "b2", amount: toBase(10170), createdAt: NOW - 40 },
    ];
    const snap = snapshot({ estate: { status: "Unlocked" }, assets: [asset], offers });
    const n = deriveNudges(snap, "agent", NOW).find((x) => x.kind === "offer-received")!;
    expect(n).toMatchObject({ id: "offer:A1:O2", urgency: "soon" });
    expect(n.body).toContain("2019 Corolla");
    expect(deriveNudges(snapshot({ estate: { status: "Unlocked" }, assets: [{ ...asset, listingEnds: NOW - 1 }], offers }), "verifier", NOW, { address: V[0] })
      .find((x) => x.kind === "offer-received")?.urgency).toBe("now");
    // Only low offers: nothing to settle.
    expect(kinds(deriveNudges(snapshot({ estate: { status: "Unlocked" }, assets: [asset], offers: [offers[0]] }), "agent", NOW))).not.toContain("offer-received");
    expect(kinds(deriveNudges(snap, "buyer", NOW))).not.toContain("offer-received");
  });

  it("legacy-message: a child's first-fees message after the UCT claim is paid", () => {
    const paid = snapshot({ estate: { status: "Unlocked" }, claims: [claim({ status: "Paid" })] });
    const hint = { calledBy: "Dad", milestones: [{ id: "lerato-uct-fees", title: "Your UCT fees are paid" }] };
    const n = deriveNudges(paid, "beneficiary", NOW, { address: LERATO, legacy: hint }).find((x) => x.kind === "legacy-message")!;
    expect(n).toMatchObject({ id: "legacy:lerato-uct-fees", urgency: "info", title: "A message from Dad" });
    expect(n.body).toContain("Your UCT fees are paid");
    expect(n.primary.action).toEqual({ type: "navigate", to: "/legacy" });
    // Unknown book: a generic message nudge. Known to have none (null or empty): nothing.
    expect(kinds(deriveNudges(paid, "beneficiary", NOW, { address: LERATO }))).toContain("legacy-message");
    expect(kinds(deriveNudges(paid, "beneficiary", NOW, { address: LERATO, legacy: null }))).not.toContain("legacy-message");
    expect(kinds(deriveNudges(paid, "beneficiary", NOW, { address: LERATO, legacy: { calledBy: "Dad", milestones: [] } }))).not.toContain("legacy-message");
    // Not paid yet, or someone else's claim.
    expect(kinds(deriveNudges(snapshot({ estate: { status: "Unlocked" }, claims: [claim()] }), "beneficiary", NOW, { address: LERATO, legacy: hint }))).not.toContain("legacy-message");
    expect(kinds(deriveNudges(paid, "beneficiary", NOW, { address: "sipho", legacy: hint }))).not.toContain("legacy-message");
  });

  it("heartbeat: owner overdue after 30 days", () => {
    expect(kinds(deriveNudges(snapshot({ estate: { lastHeartbeat: NOW - 29 * DAY } }), "owner", NOW))).not.toContain("heartbeat");
    const n = deriveNudges(snapshot({ estate: { lastHeartbeat: NOW - 31 * DAY } }), "owner", NOW).find((x) => x.kind === "heartbeat")!;
    expect(n.id).toBe(`heartbeat:${NOW - 31 * DAY}`);
    expect(n.body).toContain("31 days");
    expect(deriveNudges(snapshot({ estate: { lastHeartbeat: 0 } }), "owner", NOW).find((x) => x.kind === "heartbeat")?.body).toBe(chatCopy().nudges.heartbeat.bodyNever);
    expect(kinds(deriveNudges(snapshot({ estate: { lastHeartbeat: 0 } }), "beneficiary", NOW, { address: LERATO }))).not.toContain("heartbeat");
  });

  it("fund-vault: vault below the next 30 days of scheduled payments", () => {
    // 85 every 7 days, due now: 5 payments in 30 days = 425.
    const weekly = books({ intervalSecs: 7 * DAY, nextDue: NOW });
    expect(upcomingScheduled(snapshot({ rules: [weekly] }), NOW)).toBe(toBase(425));
    // Capped by what's left on the rule.
    expect(upcomingScheduled(snapshot({ rules: [weekly] }), NOW + 0, 30 * DAY)).toBe(toBase(425));
    expect(upcomingScheduled(snapshot({ rules: [{ ...weekly, spentTotal: toBase(2000 - 170) }] }), NOW)).toBe(toBase(170));
    const low = deriveNudges(snapshot({ rules: [weekly], estate: { vaultBalance: toBase(300) } }), "owner", NOW).find((x) => x.kind === "fund-vault")!;
    expect(low).toMatchObject({ urgency: "soon", id: `fund-vault:${toBase(425)}` });
    expect(deriveNudges(snapshot({ rules: [weekly], estate: { vaultBalance: toBase(50) } }), "owner", NOW).find((x) => x.kind === "fund-vault")?.urgency).toBe("now");
    expect(kinds(deriveNudges(snapshot({ rules: [weekly], estate: { vaultBalance: toBase(500) } }), "owner", NOW))).not.toContain("fund-vault");
  });

  it("orders by urgency, then kind, then id", () => {
    const snap = snapshot({
      estate: { lastHeartbeat: NOW - 40 * DAY, vaultBalance: toBase(10) },
      rules: [rule({ startsNow: true }), books()],
      claims: [claim()],
    });
    const list = deriveNudges(snap, "owner", NOW);
    expect(kinds(list)).toEqual(["claim-to-approve", "scheduled-due", "fund-vault", "heartbeat"]);
    const shuffled = [...list].reverse();
    expect(sortNudges(shuffled).map((n) => n.id)).toEqual(list.map((n) => n.id));
  });

  it("dismissal hides a nudge and persists per persona", () => {
    const list = deriveNudges(snapshot({ rules: [books()] }), "owner", NOW);
    const id = list[0].id;
    expect(visibleNudges(list, [id]).map((n) => n.id)).not.toContain(id);
    expect(visibleNudges(list, new Set([id]))).toHaveLength(list.length - 1);
    const st = new MemStorage();
    expect(saveDismissed(st, OWNER, [id, id])).toBe(true);
    expect(loadDismissed(st, OWNER)).toEqual([id]);
    expect(loadDismissed(st, LERATO)).toEqual([]);
    st.setItem(dismissKey("x"), "not json");
    expect(loadDismissed(st, "x")).toEqual([]);
    expect(loadDismissed(null, OWNER)).toEqual([]);
    // The next due date is a new nudge, so a dismissed payment comes back next time.
    const next = deriveNudges(snapshot({ rules: [books({ nextDue: NOW + 30 * DAY })] }), "owner", NOW + 31 * DAY);
    expect(visibleNudges(next, [id]).some((n) => n.kind === "scheduled-due")).toBe(true);
  });

  it("falls back to English copy for other locales", () => {
    const en = deriveNudges(snapshot({ rules: [books()] }), "owner", NOW);
    expect(deriveNudges(snapshot({ rules: [books()] }), "owner", NOW, { locale: "zu" })[0].title).toBe(en[0].title);
  });
});

/* ---------- threads ---------- */

describe("thread store", () => {
  const user = (text: string, ts = 1) => ({ role: "user" as const, text, ts });
  const agent = (text: string, ts = 2) => ({ role: "agent" as const, text, ts, fresh: true });

  it("derives titles from the first user message, ≤ 40 chars", () => {
    expect(deriveTitle("  How do I   claim my fees? ")).toBe("How do I claim my fees?");
    const long = deriveTitle("What happens to the car after my father passes away and the estate unlocks?");
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith("…")).toBe(true);
    expect(deriveTitle("x".repeat(60))).toHaveLength(40);
    expect(deriveTitle("   ")).toBe(NEW_CHAT_TITLE);
  });

  it("creates, selects, renames and removes threads", () => {
    let s = threadReducer(emptyThreadState, { type: "new", id: "a", now: 1 });
    s = threadReducer(s, { type: "new", id: "b", now: 2 });
    expect(s.activeId).toBe("b");
    expect(s.threads.map((t) => t.id)).toEqual(["b", "a"]);
    s = threadReducer(s, { type: "select", id: "a" });
    expect(s.activeId).toBe("a");
    expect(threadReducer(s, { type: "select", id: "zzz" })).toBe(s);
    s = threadReducer(s, { type: "rename", id: "a", title: "  Fees  " });
    expect(s.threads.find((t) => t.id === "a")!.title).toBe("Fees");
    expect(threadReducer(s, { type: "rename", id: "a", title: "   " })).toBe(s);
    s = threadReducer(s, { type: "remove", id: "a" });
    expect(s.activeId).toBeNull();
    expect(s.threads.map((t) => t.id)).toEqual(["b"]);
    s = threadReducer(s, { type: "select", id: "b" });
    s = threadReducer(s, { type: "remove", id: "zzz" });
    expect(s.activeId).toBe("b");
  });

  it("appends messages with ids, titles the thread once, clears fresh, and moves it to the top", () => {
    let s = threadReducer(emptyThreadState, { type: "new", id: "a", now: 1 });
    s = threadReducer(s, { type: "new", id: "b", now: 2 });
    s = threadReducer(s, { type: "append", id: "a", now: 3, messages: [user("How do I claim my fees?"), agent("Like this")] });
    s = threadReducer(s, { type: "append", id: "a", now: 4, messages: [user("And the car?"), agent("Sold")] });
    const a = s.threads[0];
    expect(a.id).toBe("a");
    expect(a.title).toBe("How do I claim my fees?");
    expect(a.updatedAt).toBe(4);
    expect(a.messages.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(a.messages.map((m) => !!m.fresh)).toEqual([false, false, false, true]);
    // A user-renamed thread keeps its name.
    let r = threadReducer(emptyThreadState, { type: "new", id: "c", now: 1 });
    r = threadReducer(r, { type: "rename", id: "c", title: "Mine" });
    r = threadReducer(r, { type: "append", id: "c", now: 2, messages: [user("hello")] });
    expect(r.threads[0].title).toBe("Mine");
    // Appending to a missing thread creates it; an attachment-only message is titled by file name.
    const t = threadReducer(emptyThreadState, { type: "append", id: "z", now: 5, messages: [{ role: "user", text: "", ts: 5, attachment: { name: "statement.pdf", kind: "pdf" } }] });
    expect(t.threads[0]).toMatchObject({ id: "z", title: "statement.pdf" });
  });

  it("caps threads at 30 (keeping the active one) and messages at 200", () => {
    let s: ThreadState = { threads: [], activeId: null };
    s = threadReducer(s, { type: "new", id: "old", now: 0 });
    for (let i = 1; i <= MAX_THREADS + 5; i++) s = threadReducer(s, { type: "append", id: `t${i}`, now: i, messages: [user(`q${i}`)] });
    expect(s.threads).toHaveLength(MAX_THREADS);
    expect(s.activeId).toBe("old");
    expect(s.threads.some((t) => t.id === "old")).toBe(true);
    expect(s.threads.some((t) => t.id === "t1")).toBe(false);
    const many = Array.from({ length: MAX_MESSAGES + 20 }, (_, i) => user(`m${i}`, i));
    const big = threadReducer(emptyThreadState, { type: "append", id: "x", now: 1, messages: many });
    expect(big.threads[0].messages).toHaveLength(MAX_MESSAGES);
    expect(big.threads[0].messages.at(-1)!.text).toBe(`m${MAX_MESSAGES + 19}`);
    expect(capState({ threads: [], activeId: "gone" }).activeId).toBeNull();
  });

  it("round-trips through storage per persona, versioned and fault-tolerant", () => {
    const st = new MemStorage();
    let s = threadReducer(emptyThreadState, { type: "append", id: "a", now: 3, messages: [user("hi"), agent("hello")] });
    s = threadReducer(s, { type: "select", id: "a" });
    expect(saveThreads(st, OWNER, s)).toBe(true);
    const back = loadThreads(st, OWNER);
    expect(back.activeId).toBe("a");
    expect(back.threads[0].messages.map((m) => [m.role, m.text, !!m.fresh])).toEqual([["user", "hi", false], ["agent", "hello", false]]);
    expect(loadThreads(st, LERATO)).toEqual(emptyThreadState);
    expect(storageKey("")).toBe(storageKey("guest"));
    st.setItem(storageKey("bad"), "{nope");
    expect(loadThreads(st, "bad")).toEqual(emptyThreadState);
    st.setItem(storageKey("old"), JSON.stringify({ v: 0, threads: [] }));
    expect(loadThreads(st, "old")).toEqual(emptyThreadState);
    st.setItem(storageKey("junk"), JSON.stringify({ v: 1, activeId: 5, threads: [{ id: 1 }, { id: "ok", title: "t", createdAt: 1, updatedAt: 1, messages: [{ nope: 1 }] }] }));
    expect(loadThreads(st, "junk")).toEqual({ activeId: null, threads: [{ id: "ok", title: "t", createdAt: 1, updatedAt: 1, messages: [] }] });
    expect(saveThreads(null, OWNER, s)).toBe(false);
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(loadThreads(throwing, OWNER)).toEqual(emptyThreadState);
    expect(saveThreads(throwing, OWNER, s)).toBe(false);
  });
});

/* ---------- suggestions, attachments, pipeline ---------- */

describe("chat helpers", () => {
  it("suggestions depend on role and estate status", () => {
    expect(suggestionsFor(null, null)).toEqual(chatCopy().suggestions.guest);
    expect(suggestionsFor("owner", null)).toEqual(chatCopy().suggestions.owner.none);
    expect(suggestionsFor("beneficiary", "Unlocked")).toContain("How do I claim my fees?");
    expect(suggestionsFor("verifier", "DeathPending")).toEqual(chatCopy().suggestions.verifier.DeathPending);
    expect(suggestionsFor("buyer", "Frozen")).toEqual(chatCopy().suggestions.buyer.Active);
    for (const role of ["owner", "beneficiary", "verifier", "buyer", "agent"] as const) {
      for (const st of ["Active", "DeathPending", "Unlocked"] as const) expect(suggestionsFor(role, st).length).toBeGreaterThan(0);
    }
  });

  it("guesses the reviewer purpose", () => {
    expect(reviewPurpose("hardship", "", "x.pdf")).toBe("hardship");
    expect(reviewPurpose("general", "here is the death certificate", "x.pdf")).toBe("death");
    expect(reviewPurpose(undefined, "", "affidavit.jpg")).toBe("hardship");
    expect(reviewPurpose(undefined, "", "statement.pdf")).toBe("claim");
  });

  it("turns a review into an agent message with the right next step", () => {
    const report: AgentReport = { verdict: "approve", documentType: "fee_statement", extracted: {}, redFlags: [], confidence: 0.93, summary: "A UCT fee statement.", reportHash: "h" };
    const snap = snapshot({ estate: { status: "Unlocked" } });
    const r = attachmentReply(report, { name: "fees.pdf", purpose: "claim", role: "beneficiary", snap, address: LERATO });
    expect(r.text).toContain("a fee statement, 93% sure");
    expect(r.text).toContain("A UCT fee statement.");
    expect(r.actions[0]).toEqual({ type: "openClaimForm", rule: "RuleTuition", payee: UCT });
    const death = attachmentReply({ ...report, documentType: "death_certificate" }, { name: "c.pdf", purpose: "death", role: "beneficiary", snap: snapshot(), address: LERATO });
    expect(death.actions).toEqual([{ type: "startUpload", purpose: "death" }]);
    const bad = attachmentReply({ ...report, verdict: "reject", redFlags: ["Altered amount"] }, { name: "f.pdf", purpose: "claim", role: "beneficiary", snap, address: LERATO });
    expect(bad.text).toContain("Altered amount");
    expect(bad.actions).toEqual([]);
    expect(attachmentReply(report, { name: "f.pdf", purpose: "claim", role: "verifier", snap, address: V[0] }).actions).toEqual([{ type: "navigate", to: "/inbox" }]);
  });

  it("runs a turn on-device in mock mode, through the orchestrator in chain mode, and falls back when it fails", async () => {
    const base = { service: null, isMock: true, snap: snapshot(), fx: null, session: null, role: "owner" as const, page: "/", locale: "en" as const };
    const sleep = vi.fn(async () => undefined);
    const mock = await runAssistantTurn("What's in the vault?", [], base, assistant, { sleep });
    expect(sleep).toHaveBeenCalled();
    expect(mock.fellBack).toBe(false);
    expect(mock.reply.specialist).toBe("EstateGuide");

    const service = { savedRecipients: async () => [], getFx: async () => ({ usdtZar: 18, source: "t", fetchedAt: 0 }) } as never;
    const fetchOk = vi.fn(async () => new Response(JSON.stringify({ specialist: "ClaimsGuide", reply: "From the server", actions: [{ type: "navigate", to: "/owner" }] })));
    const chain = await runAssistantTurn("How do claims work?", [{ role: "user", text: "hi" }], { ...base, isMock: false, service }, assistant, { fetch: fetchOk as never, sleep });
    expect(chain).toEqual({ fellBack: false, reply: { specialist: "ClaimsGuide", reply: "From the server", actions: [{ type: "navigate", to: "/estate" }] } });
    const body = JSON.parse((fetchOk.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.history).toEqual([{ role: "user", text: "hi" }]);

    const fetchFail = vi.fn(async () => { throw new Error("offline"); });
    const fb = await runAssistantTurn("How do claims work?", [], { ...base, isMock: false, service }, assistant, { fetch: fetchFail as never, sleep });
    expect(fb.fellBack).toBe(true);
    expect(turnText(fb, assistant).startsWith(assistant.chat.errorFallback)).toBe(true);
  });

  it("routes payment requests to the wallet assistant as a review button", async () => {
    const service = {} as never;
    const interpret = vi.fn(async () => ({
      plan: { ok: true, to: LERATO, toLabel: "Lerato", amountUsdt: 27.5, amountZar: 500, memo: "books", intent: {} },
      intent: {}, engine: "qvac", note: "", recipients: [], rate: 18.2,
    }));
    const r = await runAssistantTurn("Send R500 to Lerato for books", [], { service, isMock: true, snap: null, fx: null, session: null, role: "owner", page: "/", locale: "en" }, assistant, { interpret: interpret as never });
    expect(interpret).toHaveBeenCalled();
    expect(r.reply.actions[0]).toMatchObject({ type: "reviewSend", to: LERATO, amountUsdt: 27.5 });
  });
});
