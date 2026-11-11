import { describe, expect, it } from "vitest";
import { isDue } from "./scheduler";
import type { Rule } from "../types";

const rule = (over: Partial<Rule> = {}): Rule => ({
  address: "R", id: 0, beneficiary: "B", category: "Accommodation", allowedPayeeKind: "Landlord",
  maxPerClaim: 300n, lifetimeCap: 1000n, spentTotal: 0n, validUntil: 2_000, startsNow: true,
  recurringAmount: 300n, intervalSecs: 60, nextDue: 1_000, fixedPayee: "P", ...over,
});

describe("scheduler isDue (mirrors execute_scheduled)", () => {
  it("pays a due living-plan rule while the owner is alive", () => expect(isDue(rule(), "Active", 1_000)).toBe(true));
  it("waits until next_due", () => expect(isDue(rule(), "Active", 999)).toBe(false));
  it("after-death rules need an unlocked estate", () => {
    expect(isDue(rule({ startsNow: false }), "Active", 1_500)).toBe(false);
    expect(isDue(rule({ startsNow: false }), "Unlocked", 1_500)).toBe(true);
  });
  it("respects the lifetime cap and end date", () => {
    expect(isDue(rule({ spentTotal: 800n }), "Active", 1_500)).toBe(false);
    expect(isDue(rule(), "Active", 2_001)).toBe(false);
  });
  it("ignores non-recurring rules and frozen estates", () => {
    expect(isDue(rule({ recurringAmount: 0n }), "Active", 1_500)).toBe(false);
    expect(isDue(rule(), "Frozen", 1_500)).toBe(false);
    expect(isDue(rule(), "DeathPending", 1_500)).toBe(false);
  });
});
