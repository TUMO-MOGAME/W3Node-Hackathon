/**
 * Clearly-labelled canned answers used when GEMINI_API_KEY is not set, so the demo still runs end to end.
 * Every text starts with CANNED_PREFIX so nobody mistakes it for a live model answer.
 */
import type { CarValuation, WillDraft } from "../types";
import type { ModelReport } from "./schemas";

export const CANNED_PREFIX = "[Demo answer: AI not configured] ";

export const DEMO_WILL: WillDraft = {
  ownerName: "Thabo Mokoena",
  beneficiaries: [
    { label: "Lerato (daughter)", relationship: "daughter" },
    { label: "Sipho (son)", relationship: "son" },
    { label: "Naledi (daughter)", relationship: "daughter" },
  ],
  verifiers: [
    { name: "Adv. Ndlovu", role: "executor" },
    { name: "Ms. Pillay", role: "attorney" },
    { name: "Uncle Bongani", role: "family" },
  ],
  rules: [
    { beneficiaryLabel: "Lerato (daughter)", category: "Tuition", allowedPayeeKind: "University", maxPerClaimUsdt: 4000, lifetimeCapUsdt: 16000, validUntil: "2031-12-31", notes: "University fees paid to the university only", startsNow: false },
    { beneficiaryLabel: "Lerato (daughter)", category: "Accommodation", allowedPayeeKind: "Landlord", maxPerClaimUsdt: 600, lifetimeCapUsdt: 9000, validUntil: "2031-12-31", notes: "Residence rent paid automatically every month, starting now (living plan)", startsNow: true, recurring: { amountUsdt: 300, every: "month", payeeName: "Tugwell Residence" } },
    { beneficiaryLabel: "Sipho (son)", category: "Tuition", allowedPayeeKind: "University", maxPerClaimUsdt: 4000, lifetimeCapUsdt: 16000, validUntil: "2033-12-31", notes: "University fees paid to the university only", startsNow: false },
    { beneficiaryLabel: "Naledi (daughter)", category: "Tuition", allowedPayeeKind: "School", maxPerClaimUsdt: 2500, lifetimeCapUsdt: 12000, validUntil: "2034-12-31", notes: "School fees, claimable now with Thabo's approval (living plan)", startsNow: true },
  ],
  assets: [{
    title: "2019 Toyota Corolla 1.8 Prestige", floorPriceUsdt: 9000, hardshipFloorUsdt: 7000, askingPriceUsdt: 10500,
    proceedsTo: "estate vault", hardshipPolicy: "Below the floor only for proven hardship, approved by 2 of 3 verifiers, never below 7,000 USD₮",
  }],
  waitingPeriodDays: 14,
  plainLanguageSummary:
    "Thabo's USD₮ pays his children's education directly to their university, school or residence, within fixed caps. " +
    "Two rules work now, while he is alive: Lerato's residence rent is paid automatically every month, and Naledi's school fees can be claimed with his approval. " +
    "Everything else waits until two of three verifiers confirm his death and 14 days pass, and he can veto at any time. " +
    "The Corolla is sold for at least 9,000 USD₮, or at least 7,000 USD₮ if a child proves real hardship.",
};

export function cannedWillTurn(turns: number): { reply: string; draft: WillDraft | null } {
  if (turns <= 1) {
    return { reply: `${CANNED_PREFIX}Thanks, Thabo. Who should benefit, and what should the money be used for? For example: university fees paid straight to the university, up to a yearly amount.`, draft: null };
  }
  return { reply: `${CANNED_PREFIX}Here is a draft based on what you told me. Please check each rule before you sign.`, draft: DEMO_WILL };
}

export function cannedReport(purpose: "death" | "claim" | "hardship"): ModelReport {
  const base = {
    death: { documentType: "death_certificate", extracted: [{ field: "issuer", value: "Department of Home Affairs (demo)" }] },
    claim: { documentType: "fee_statement", extracted: [{ field: "institution", value: "University of Cape Town (demo)" }] },
    hardship: { documentType: "affidavit", extracted: [{ field: "commissioner", value: "SAPS (demo)" }] },
  }[purpose];
  return {
    verdict: "needs_human",
    ...base,
    redFlags: ["The AI reviewer is not configured, so this document was NOT read. A human must check it."],
    confidence: 0,
    summary: `${CANNED_PREFIX}No automatic review was done. Verifiers must read the document themselves.`,
  };
}

export function cannedValuation(): CarValuation {
  return {
    suggestedAskingUsdt: 10500, lowUsdt: 9200, highUsdt: 11400,
    comparables: [
      { title: "2019 Toyota Corolla 1.8 Prestige, 78,000 km (demo)", priceZar: 189_900, source: "demo data" },
      { title: "2019 Toyota Corolla 1.8 XS CVT, 92,000 km (demo)", priceZar: 174_995, source: "demo data" },
      { title: "2020 Toyota Corolla 1.8 Prestige, 65,000 km (demo)", priceZar: 214_900, source: "demo data" },
    ],
    rationale: `${CANNED_PREFIX}Fixed example comparables; live web-search valuation needs GEMINI_API_KEY.`,
  };
}
