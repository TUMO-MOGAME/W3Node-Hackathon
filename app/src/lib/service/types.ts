/**
 * The one interface the UI talks to. Two implementations:
 *  - mock.ts  (owned by the UI/design agent): in-memory demo data, instant, used for design and as offline fallback
 *  - chain.ts (owned by the chain/agent backend): Solana devnet via the Anchor client, WDK signing, Gemini API routes
 * Selected in ./index.ts by NEXT_PUBLIC_DATA_MODE = "mock" | "chain".
 * Every write returns the tx signature (mock returns a fake one) so the UI can link Solana Explorer.
 */
import type {
  ActivityItem, AgentReport, Asset, Base58, CarValuation, Category, Claim, Estate, FxRate,
  Hardship, Offer, OfferRanking, PayeeKind, Payee, Rule, Beneficiary, WillChatMessage, WillDraft,
  PaymentReview, PaymentReceipt, SavedRecipient,
} from "../types";

export interface TxResult { signature: string; explorerUrl: string }

export interface EstateSnapshot {
  estate: Estate;
  beneficiaries: Beneficiary[];
  payees: Payee[];
  rules: Rule[];
  claims: Claim[];
  assets: Asset[];
  offers: Offer[];
  hardships: Hardship[];
  activity: ActivityItem[];
}

export interface HeirloomService {
  mode: "mock" | "chain";

  // Reads
  getEstate(estate: Base58): Promise<EstateSnapshot>;
  listEstatesFor(wallet: Base58): Promise<{ estate: Base58; role: string; ownerName: string }[]>;
  getFx(): Promise<FxRate>;

  // AI agent (server routes)
  willChat(history: WillChatMessage[]): Promise<{ reply: string; draft: WillDraft | null }>;
  reviewDocument(input: { file: File; purpose: "death" | "claim" | "hardship"; context: string }): Promise<AgentReport>;
  valueCar(input: { make: string; model: string; year: number; mileageKm: number; condition: string }): Promise<CarValuation>;
  rankOffers(asset: Base58): Promise<OfferRanking>;

  // Owner
  createEstateFromWill(draft: WillDraft): Promise<{ estate: Base58; txs: TxResult[] }>;
  deposit(estate: Base58, amountUsdt: number): Promise<TxResult>;
  withdraw(estate: Base58, amountUsdt: number): Promise<TxResult>;
  heartbeat(estate: Base58): Promise<TxResult>;
  registerAsset(estate: Base58, input: { nftMint: Base58; title: string; floorUsdt: number; hardshipFloorUsdt: number; askingUsdt: number; proceedsTo: Base58; docFile?: File }): Promise<TxResult>;
  addPayee(estate: Base58, input: { wallet: Base58; kind: PayeeKind; name: string }): Promise<TxResult>;
  addRule(estate: Base58, input: { beneficiary: Base58; category: Category; allowedPayeeKind: PayeeKind; maxPerClaimUsdt: number; lifetimeCapUsdt: number; validUntil: number; startsNow: boolean; recurring?: { amountUsdt: number; intervalSecs: number; firstDue: number; payee: Base58 } }): Promise<TxResult>;
  /** Living plan: owner approves a claim on a startsNow rule while alive (counts as full approval). */
  ownerApproveClaim(estate: Base58, claim: Base58): Promise<TxResult>;
  /** Scheduled payment: anyone (UI button, agent, cron) triggers a due recurring payout. */
  executeScheduled(estate: Base58, rule: Base58): Promise<TxResult>;
  vetoDeath(estate: Base58): Promise<TxResult>;

  // Family
  submitDeathClaim(estate: Base58, certificate: File): Promise<{ tx: TxResult; report: AgentReport }>;
  submitClaim(estate: Base58, input: { rule: Base58; payee: Base58; amountUsdt: number; evidence: File }): Promise<{ tx: TxResult; claim: Base58; report: AgentReport }>;
  submitHardship(estate: Base58, input: { asset: Base58; evidence: File }): Promise<{ tx: TxResult; report: AgentReport }>;

  // Verifiers
  attestDeath(estate: Base58): Promise<TxResult>;
  approveClaim(estate: Base58, claim: Base58): Promise<TxResult>;
  approveHardship(estate: Base58, hardship: Base58): Promise<TxResult>;

  // Anyone
  finalizeUnlock(estate: Base58): Promise<TxResult>;
  executeClaim(estate: Base58, claim: Base58): Promise<TxResult>;

  // Tether track payment flow (review → approve → WDK sign → pending → confirmed)
  /** Validates address/network/token, reads balances, quotes the fee. Nothing is signed. */
  reviewSend(input: { to: Base58; toLabel: string; amountUsdt: number }): Promise<PaymentReview>;
  /** Signs + submits with WDK after the user approved `review`. Idempotent on review.id. */
  confirmSend(review: PaymentReview): Promise<PaymentReceipt>;
  /** Re-checks a payment by id (after reconnect / reload). Never re-sends if a signature exists. */
  getReceipt(id: string): Promise<PaymentReceipt | null>;
  listPendingReceipts(): Promise<PaymentReceipt[]>;
  savedRecipients(): Promise<SavedRecipient[]>;

  // Car sale
  listAsset(estate: Base58, asset: Base58, durationSecs: number): Promise<TxResult>;
  placeOffer(estate: Base58, asset: Base58, amountUsdt: number): Promise<TxResult>;
  withdrawOffer(estate: Base58, asset: Base58): Promise<TxResult>;
  acceptBestOffer(estate: Base58, asset: Base58): Promise<{ tx: TxResult; ranking: OfferRanking }>;
}
