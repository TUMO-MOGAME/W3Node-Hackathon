/**
 * Shared domain types. The UI and the chain/agent layers both build against this file.
 * Mirrors docs/program-spec.md. Amounts are USD₮ base units (6 decimals) as bigint;
 * use helpers in lib/format.ts for display. Times are unix seconds.
 * Do not change shapes without updating docs/program-spec.md and both service implementations.
 */

export type Base58 = string;
export type HexHash = string; // 64 hex chars, sha256

export type EstateStatus = "Active" | "DeathPending" | "Unlocked" | "Frozen";
export type Category = "Tuition" | "Accommodation" | "Books" | "Medical" | "General";
export type PayeeKind = "University" | "School" | "Landlord" | "Other";
export type Verdict = "Pending" | "Approved" | "Rejected";
export type ClaimStatus = "Open" | "Paid" | "Rejected";
export type AssetStatus = "Held" | "Listed" | "Sold";
export type HardshipStatus = "Open" | "Approved" | "Rejected";

export type Role = "owner" | "beneficiary" | "verifier" | "buyer" | "agent";

export interface Estate {
  address: Base58;
  owner: Base58;
  ownerName: string; // off-chain display name
  agent: Base58;
  usdtMint: Base58;
  verifiers: [Base58, Base58, Base58];
  verifierNames: [string, string, string];
  deathThreshold: number;
  claimThreshold: number;
  hardshipThreshold: number;
  waitingPeriodSecs: number;
  status: EstateStatus;
  willHash: HexHash | null;
  vaultBalance: bigint;
  death: {
    certHash: HexHash | null;
    submittedBy: Base58 | null;
    verdict: Verdict;
    attestations: boolean[]; // index = verifier index
    pendingSince: number | null;
    /** The agent's review of the death certificate (off-chain JSON; its hash is in the DeathReviewed event). */
    agentReport?: AgentReport;
  };
  lastHeartbeat: number;
}

export interface Beneficiary {
  address: Base58; // PDA
  wallet: Base58;
  label: string; // e.g. "Lerato (daughter)"
  active: boolean;
}

export interface Payee {
  address: Base58;
  wallet: Base58;
  kind: PayeeKind;
  name: string; // e.g. "University of Cape Town"
}

export interface Rule {
  address: Base58;
  id: number;
  beneficiary: Base58; // wallet
  category: Category;
  allowedPayeeKind: PayeeKind;
  maxPerClaim: bigint;
  lifetimeCap: bigint;
  spentTotal: bigint;
  validUntil: number;
  /** Living plan: true = rule works now, while the owner is alive (owner approval suffices); false = only after death unlock. */
  startsNow: boolean;
  /** Scheduled payment: >0 = pay this amount to fixedPayee every intervalSecs (no claim needed). */
  recurringAmount: bigint;
  intervalSecs: number;
  nextDue: number | null;
  fixedPayee: Base58 | null;
}

export interface Claim {
  address: Base58;
  rule: Base58;
  id: number;
  beneficiary: Base58;
  payee: Base58; // wallet
  amount: bigint;
  evidenceHash: HexHash;
  agentVerdict: Verdict;
  agentReport?: AgentReport;
  approvals: boolean[];
  /** Living plan: the owner approved this claim himself while alive (counts as full approval). */
  ownerApproved: boolean;
  status: ClaimStatus;
  createdAt: number;
  txSignature?: string;
}

export interface Asset {
  address: Base58;
  nftMint: Base58;
  title: string; // e.g. "2019 Toyota Corolla 1.8 Prestige"
  imageUrl?: string;
  floorPrice: bigint;
  hardshipFloor: bigint;
  askingPrice: bigint;
  proceedsTo: Base58;
  status: AssetStatus;
  listingEnds: number | null;
  docHash: HexHash;
  hardshipBeneficiary: Base58 | null;
}

export interface Offer {
  address: Base58;
  asset: Base58;
  buyer: Base58;
  buyerName?: string;
  amount: bigint;
  createdAt: number;
}

export interface Hardship {
  address: Base58;
  asset: Base58;
  beneficiary: Base58;
  evidenceHash: HexHash;
  agentVerdict: Verdict;
  agentReport?: AgentReport;
  approvals: boolean[];
  status: HardshipStatus;
}

/** What the AI agent returns after reading a document. Its hash goes on-chain. */
export interface AgentReport {
  verdict: "approve" | "reject" | "needs_human";
  documentType: string; // "death_certificate" | "fee_statement" | "affidavit" | ...
  extracted: Record<string, string>;
  redFlags: string[];
  confidence: number; // 0..1
  summary: string; // plain language, shown to verifiers
  reportHash: HexHash;
}

/** Structured will produced by the will-writer agent, reviewed and signed by the owner. */
export interface WillDraft {
  ownerName: string;
  beneficiaries: { label: string; relationship: string; wallet?: Base58 }[];
  verifiers: { name: string; role: string; wallet?: Base58 }[];
  rules: {
    beneficiaryLabel: string;
    category: Category;
    allowedPayeeKind: PayeeKind;
    maxPerClaimUsdt: number;
    lifetimeCapUsdt: number;
    validUntil: string; // ISO date
    notes: string;
    startsNow: boolean; // living plan (pay while alive) vs legacy (after death)
    recurring?: { amountUsdt: number; every: "minute" | "week" | "month" | "term" | "year"; payeeName: string };
  }[];
  assets: {
    title: string;
    floorPriceUsdt: number;
    hardshipFloorUsdt: number;
    askingPriceUsdt: number;
    proceedsTo: string; // label or wallet
    hardshipPolicy: string;
  }[];
  waitingPeriodDays: number;
  plainLanguageSummary: string;
}

export interface WillChatMessage {
  role: "user" | "agent";
  text: string;
}

export interface CarValuation {
  suggestedAskingUsdt: number;
  lowUsdt: number;
  highUsdt: number;
  comparables: { title: string; priceZar: number; source: string; url?: string }[];
  rationale: string;
}

export interface OfferRanking {
  bestOffer: Base58 | null;
  eligible: { offer: Base58; amount: bigint; reason: string }[];
  ineligible: { offer: Base58; amount: bigint; reason: string }[];
}

export interface ActivityItem {
  ts: number;
  kind: string; // event name, e.g. "ClaimPaid"
  text: string;
  amount?: bigint;
  txSignature?: string;
  /** For *Reviewed events: the agent report hash, to join the off-chain report. */
  reportHash?: HexHash;
}

export interface FxRate {
  usdtZar: number;
  source: string; // e.g. "VALR" or "fallback"
  fetchedAt: number;
}

/**
 * Tether track payment flow (Mobile Money & P2P): validate → balance + fee quote → review (approve/cancel)
 * → WDK signs + submits → receipt pending → confirmed. Every USD₮ movement the user initiates goes through this.
 */
export interface PaymentReview {
  id: string; // idempotency key, generated before signing; reused on retry so nobody pays twice
  kind: "p2p" | "vault-deposit" | "offer" | "claim-payout" | "scheduled" | "program";
  from: Base58;
  to: Base58;
  toLabel: string; // "Lerato (daughter)", "University of Cape Town"
  amount: bigint; // USD₮ base units
  token: { symbol: "USD₮"; mint: Base58; verified: boolean }; // verified = matches the configured USD₮ mint
  network: { name: string; cluster: "devnet" | "mainnet-beta" | "localnet" };
  fee: { lamports: number; sol: number; payer: Base58; sponsored: boolean };
  balances: { usdt: bigint; sol: number; sufficient: boolean };
  warnings: string[]; // e.g. "Recipient has no USD₮ account yet — it will be created (small SOL fee)"
  simulated?: boolean; // label on screen when any part is simulated
}

export type PaymentStatus = "draft" | "awaiting-approval" | "signing" | "submitted" | "pending" | "confirmed" | "failed" | "cancelled";

export interface PaymentReceipt {
  id: string; // same idempotency key as the review
  status: PaymentStatus;
  signature?: string;
  explorerUrl?: string;
  confirmations?: number;
  error?: string; // human-readable, with a recovery hint
  updatedAt: number;
}

export interface SavedRecipient {
  label: string;
  address: Base58;
  relationship?: string;
}

/** A WDK-backed wallet session in the browser. */
export interface WalletSession {
  address: Base58;
  label: string;
  role: Role;
  solBalance: number;
  usdtBalance: bigint;
}
