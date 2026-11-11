import { describe, expect, it } from "vitest";
import { willDraftChecked, willDraftSchema, rankOffersBody, valuationBody, modelReportSchema } from "./schemas";
import { uiActionSchema } from "./actions";
import { DEMO_WILL } from "./canned";
import { checkClaim, type EstateFacts } from "./facts";
import { keywordRoute } from "./orchestrator";

describe("WillDraft schema", () => {
  it("accepts the demo will", () => {
    expect(willDraftChecked.safeParse(DEMO_WILL).success).toBe(true);
  });

  it("rejects per-claim cap above lifetime cap", () => {
    const bad = { ...DEMO_WILL, rules: [{ ...DEMO_WILL.rules[0], maxPerClaimUsdt: 20000 }] };
    expect(willDraftSchema.safeParse(bad).success).toBe(true); // shape is fine…
    const r = willDraftChecked.safeParse(bad); // …but the contract rule is not
    expect(r.success).toBe(false);
  });

  it("rejects hardship floor above floor and asking below floor", () => {
    const a = DEMO_WILL.assets[0];
    expect(willDraftChecked.safeParse({ ...DEMO_WILL, assets: [{ ...a, hardshipFloorUsdt: 9500 }] }).success).toBe(false);
    expect(willDraftChecked.safeParse({ ...DEMO_WILL, assets: [{ ...a, askingPriceUsdt: 100 }] }).success).toBe(false);
  });

  it("rejects rules for unknown beneficiaries and bad wallets", () => {
    expect(willDraftChecked.safeParse({ ...DEMO_WILL, rules: [{ ...DEMO_WILL.rules[0], beneficiaryLabel: "Nobody" }] }).success).toBe(false);
    expect(willDraftSchema.safeParse({ ...DEMO_WILL, beneficiaries: [{ label: "X", relationship: "son", wallet: "not-a-key" }] }).success).toBe(false);
  });
});

describe("API body schemas", () => {
  it("rank-offers parses base-unit strings to bigint", () => {
    const k = "11111111111111111111111111111111";
    const b = rankOffersBody.parse({
      asset: { address: k, floorPrice: "9000000000", hardshipFloor: 7000000000, hardshipBeneficiary: null, status: "Listed" },
      offers: [{ address: k, buyer: k, amount: "9500000000", createdAt: 1 }],
    });
    expect(b.asset.floorPrice).toBe(9_000_000_000n);
    expect(b.offers[0].amount).toBe(9_500_000_000n);
  });

  it("valuation rejects silly input", () => {
    expect(valuationBody.safeParse({ make: "Toyota", model: "Corolla", year: 1800, mileageKm: 1, condition: "" }).success).toBe(false);
  });

  it("model report confidence must be 0..1", () => {
    expect(modelReportSchema.safeParse({ verdict: "approve", documentType: "x", extracted: [], redFlags: [], confidence: 2, summary: "" }).success).toBe(false);
  });
});

describe("UI actions", () => {
  it("validates agent intents", () => {
    expect(uiActionSchema.safeParse({ type: "navigate", path: "/family" }).success).toBe(true);
    expect(uiActionSchema.safeParse({ type: "navigate", path: "https://evil.example" }).success).toBe(false);
    expect(uiActionSchema.safeParse({ type: "startUpload", purpose: "death" }).success).toBe(true);
    expect(uiActionSchema.safeParse({ type: "deleteEverything" }).success).toBe(false);
  });
});

describe("claim pre-check (mirrors submit_claim)", () => {
  const facts: EstateFacts = {
    estate: { address: "E", status: "Unlocked", ownerName: "T", vaultUsdt: 1000, waitingPeriodSecs: 0, deathThreshold: 2, claimThreshold: 1, hardshipThreshold: 2, death: { verdict: "Approved", attestations: 2, pendingSince: null } },
    beneficiaries: [], payees: [{ wallet: "UCT", name: "UCT", kind: "University" }, { wallet: "RES", name: "Res", kind: "Landlord" }],
    rules: [{ address: "R0", id: 0, beneficiary: "B", beneficiaryLabel: "Lerato", category: "Tuition", allowedPayeeKind: "University", maxPerClaimUsdt: 4000, lifetimeCapUsdt: 16000, spentUsdt: 14000, remainingUsdt: 2000, validUntil: 2_000_000_000 }],
    claims: [], asset: null, offers: [], hardships: [], recentActivity: [],
  };
  it("passes within caps", () => expect(checkClaim(facts, 0, 1500, "UCT", 1_800_000_000).ok).toBe(true));
  it("blocks over the remaining lifetime cap", () => {
    const r = checkClaim(facts, 0, 3000, "UCT", 1_800_000_000);
    expect(r.ok).toBe(false);
    expect(r.maxAllowedUsdt).toBe(2000);
  });
  it("blocks wrong payee kind, expiry and locked estates", () => {
    expect(checkClaim(facts, 0, 100, "RES", 1_800_000_000).problems.join()).toMatch(/only pays a University/);
    expect(checkClaim(facts, 0, 100, "UCT", 2_100_000_000).problems.join()).toMatch(/expired/);
    expect(checkClaim({ ...facts, estate: { ...facts.estate, status: "Active" } }, 0, 100, "UCT", 1_800_000_000).ok).toBe(false);
  });
});

describe("keyword router fallback", () => {
  it("routes by topic and role", () => {
    expect(keywordRoute("Who can see my documents? Is this POPIA compliant?")).toBe("Compliance");
    expect(keywordRoute("I want to sell the car")).toBe("CarBroker");
    expect(keywordRoute("Pay my tuition fees")).toBe("ClaimsGuide");
    expect(keywordRoute("hello", "owner")).toBe("WillWriter");
  });
});

describe("scheduled payments", () => {
  it("demo will has a recurring living-plan rule within its cap", async () => {
    const { DEMO_WILL } = await import("./canned");
    const r = DEMO_WILL.rules.find((x) => x.recurring);
    expect(r?.startsNow).toBe(true);
    expect(r!.recurring!.amountUsdt).toBeLessThanOrEqual(r!.maxPerClaimUsdt);
  });
  it("rejects a recurring amount above the per-claim cap", () => {
    const rule = { ...DEMO_WILL.rules[1], recurring: { amountUsdt: 1e6, every: "month" as const, payeeName: "X" } };
    expect(willDraftChecked.safeParse({ ...DEMO_WILL, rules: [rule] }).success).toBe(false);
  });
});
