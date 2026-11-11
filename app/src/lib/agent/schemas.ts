/**
 * zod schemas: model outputs (validated before use) and API request bodies. Client-safe (no secrets).
 */
import { z } from "zod";

export const CATEGORIES = ["Tuition", "Accommodation", "Books", "Medical", "General"] as const;
export const PAYEE_KINDS = ["University", "School", "Landlord", "Other"] as const;
export const PURPOSES = ["death", "claim", "hardship"] as const;
export const RECURRENCE = ["minute", "week", "month", "term", "year"] as const;

/** Interval for a recurring schedule. "minute" exists for demos; NEXT_PUBLIC_DEMO_INTERVAL_SECS overrides all. */
export function intervalSecs(every: (typeof RECURRENCE)[number]): number {
  const demo = Number(process.env.NEXT_PUBLIC_DEMO_INTERVAL_SECS ?? "");
  if (Number.isFinite(demo) && demo > 0) return demo;
  return { minute: 60, week: 7 * 86_400, month: 30 * 86_400, term: 91 * 86_400, year: 365 * 86_400 }[every];
}

const base58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "not a Solana address");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "use YYYY-MM-DD");
const usdt = z.number().nonnegative().max(100_000_000);

export const willDraftSchema = z.object({
  ownerName: z.string().min(1).max(80),
  beneficiaries: z.array(z.object({
    label: z.string().min(1).max(32), relationship: z.string().max(40), wallet: base58.optional(),
  })).max(10),
  verifiers: z.array(z.object({ name: z.string().min(1).max(64), role: z.string().max(40), wallet: base58.optional() })).max(3),
  rules: z.array(z.object({
    beneficiaryLabel: z.string().min(1).max(32),
    category: z.enum(CATEGORIES),
    allowedPayeeKind: z.enum(PAYEE_KINDS),
    maxPerClaimUsdt: usdt,
    lifetimeCapUsdt: usdt,
    validUntil: isoDate,
    notes: z.string().max(300),
    startsNow: z.boolean(),
    recurring: z.object({
      amountUsdt: usdt,
      every: z.enum(RECURRENCE),
      payeeName: z.string().min(1).max(64),
    }).optional(),
  })).max(20),
  assets: z.array(z.object({
    title: z.string().min(1).max(80),
    floorPriceUsdt: usdt,
    hardshipFloorUsdt: usdt,
    askingPriceUsdt: usdt,
    proceedsTo: z.string().max(64),
    hardshipPolicy: z.string().max(300),
  })).max(1),
  waitingPeriodDays: z.number().min(0).max(365),
  plainLanguageSummary: z.string().max(2000),
});

/** Business rules the contract will also enforce; checked before the owner signs so errors show early. */
export const willDraftChecked = willDraftSchema.superRefine((d, ctx) => {
  d.rules.forEach((r, i) => {
    if (r.maxPerClaimUsdt <= 0 || r.lifetimeCapUsdt <= 0) ctx.addIssue({ code: "custom", path: ["rules", i], message: "caps must be > 0" });
    if (r.maxPerClaimUsdt > r.lifetimeCapUsdt) ctx.addIssue({ code: "custom", path: ["rules", i], message: "per-claim cap exceeds lifetime cap" });
    if (!d.beneficiaries.some((b) => b.label === r.beneficiaryLabel)) ctx.addIssue({ code: "custom", path: ["rules", i, "beneficiaryLabel"], message: "unknown beneficiary" });
    if (r.recurring && (r.recurring.amountUsdt <= 0 || r.recurring.amountUsdt > r.lifetimeCapUsdt)) ctx.addIssue({ code: "custom", path: ["rules", i, "recurring"], message: "recurring amount must be > 0 and within the lifetime cap" });
  });
  d.assets.forEach((a, i) => {
    if (!(a.floorPriceUsdt >= a.hardshipFloorUsdt && a.hardshipFloorUsdt > 0)) ctx.addIssue({ code: "custom", path: ["assets", i], message: "need floor ≥ hardship floor > 0" });
    if (a.askingPriceUsdt < a.floorPriceUsdt) ctx.addIssue({ code: "custom", path: ["assets", i], message: "asking price below floor" });
  });
});

/** What the will-writer returns each turn. `draft` is null until the agent has enough to propose rules. */
export const willTurnSchema = z.object({
  reply: z.string().min(1).max(4000),
  draft: willDraftSchema.nullable(),
});

/** Model-side report: `extracted` as pairs (friendlier for structured output), hash added by us. */
export const modelReportSchema = z.object({
  verdict: z.enum(["approve", "reject", "needs_human"]),
  documentType: z.string().max(60),
  extracted: z.array(z.object({ field: z.string().max(60), value: z.string().max(300) })).max(40),
  redFlags: z.array(z.string().max(300)).max(20),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(1500),
});

export const agentReportSchema = z.object({
  verdict: z.enum(["approve", "reject", "needs_human"]),
  documentType: z.string(),
  extracted: z.record(z.string(), z.string()),
  redFlags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  reportHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export const comparablesSchema = z.object({
  comparables: z.array(z.object({
    title: z.string().max(120), priceZar: z.number().positive(), source: z.string().max(80), url: z.string().max(500).optional(),
  })).max(12),
  rationale: z.string().max(1200),
});

// ---------- API bodies ----------
export const chatMessageSchema = z.object({ role: z.enum(["user", "agent"]), text: z.string().min(1).max(4000) });
export const willChatBody = z.object({ history: z.array(chatMessageSchema).min(1).max(40) });

export const valuationBody = z.object({
  make: z.string().min(1).max(40), model: z.string().min(1).max(60), year: z.number().int().min(1980).max(2030),
  mileageKm: z.number().int().min(0).max(2_000_000), condition: z.string().max(200),
});

const bigintString = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform((v) => BigInt(v));

export const offerInputSchema = z.object({ address: base58, buyer: base58, amount: bigintString, createdAt: z.number().int() });
export const rankOffersBody = z.object({
  asset: z.object({
    address: base58,
    floorPrice: bigintString,
    hardshipFloor: bigintString,
    hardshipBeneficiary: base58.nullable(),
    status: z.enum(["Held", "Listed", "Sold"]),
    title: z.string().max(120).optional(),
  }),
  offers: z.array(offerInputSchema).max(50),
  explain: z.boolean().optional(),
});

export const acceptOfferBody = z.object({ estate: base58, asset: base58 });
export const listAssetBody = z.object({ estate: base58, asset: base58, durationSecs: z.number().int().min(60).max(60 * 60 * 24 * 60) });

export const reviewFields = z.object({
  purpose: z.enum(PURPOSES),
  estate: base58,
  context: z.string().max(2000).default(""),
  /** Claim or hardship PDA to review on-chain (death uses the estate). */
  subject: base58.optional(),
});

export type WillTurn = z.infer<typeof willTurnSchema>;
export type ModelReport = z.infer<typeof modelReportSchema>;
