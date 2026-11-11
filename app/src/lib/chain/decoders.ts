/**
 * Maps decoded Anchor accounts (raw IDL field names, BN/PublicKey values) onto lib/types.ts shapes.
 * Field access is case/underscore-insensitive (`death_threshold` or `deathThreshold`), and every
 * conversion validates its input, so an IDL mismatch surfaces as a clear error, not silent garbage.
 */
import type {
  Asset, AssetStatus, Beneficiary, Category, Claim, ClaimStatus, Estate, EstateStatus, Hardship, HardshipStatus,
  Offer, Payee, PayeeKind, Rule, Verdict,
} from "../types";

export type Raw = Record<string, unknown>;

function has(o: Raw, name: string): boolean {
  const n = name.replace(/_/g, "").toLowerCase();
  return Object.keys(o).some((k) => k.replace(/_/g, "").toLowerCase() === n);
}

function field(o: Raw, name: string): unknown {
  if (name in o) return o[name];
  const n = name.replace(/_/g, "").toLowerCase();
  for (const k of Object.keys(o)) if (k.replace(/_/g, "").toLowerCase() === n) return o[k];
  throw new Error(`Decoded account has no field "${name}"`);
}

interface HasToBase58 { toBase58(): string }
const isKey = (v: unknown): v is HasToBase58 => typeof v === "object" && v !== null && typeof (v as HasToBase58).toBase58 === "function";

export function key(o: Raw, name: string): string {
  const v = field(o, name);
  if (isKey(v)) return v.toBase58();
  if (typeof v === "string") return v;
  throw new Error(`Field "${name}" is not a public key`);
}

export function optKey(o: Raw, name: string): string | null {
  const v = field(o, name);
  return v === null || v === undefined ? null : isKey(v) ? v.toBase58() : String(v);
}

export function big(o: Raw, name: string): bigint {
  const v = field(o, name);
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (v && typeof (v as { toString(): string }).toString === "function") return BigInt((v as { toString(): string }).toString());
  throw new Error(`Field "${name}" is not an integer`);
}

export const num = (o: Raw, name: string): number => Number(big(o, name));
export const str = (o: Raw, name: string): string => String(field(o, name) ?? "");
export const bool = (o: Raw, name: string): boolean => Boolean(field(o, name));

export function hex(o: Raw, name: string): string {
  const v = field(o, name);
  const bytes = v instanceof Uint8Array ? Array.from(v) : Array.isArray(v) ? (v as number[]) : null;
  if (!bytes) throw new Error(`Field "${name}" is not a byte array`);
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ZERO_HASH = "0".repeat(64);
const nullIfZero = (h: string) => (h === ZERO_HASH ? null : h);

/** Anchor enums decode to `{ Variant: {} }`; returns the variant from `allowed`, matched case-insensitively. */
export function enumOf<T extends string>(o: Raw, name: string, allowed: readonly T[]): T {
  const v = field(o, name);
  const variant = typeof v === "string" ? v : v && typeof v === "object" ? Object.keys(v)[0] : undefined;
  const hit = allowed.find((a) => a.toLowerCase() === String(variant).toLowerCase());
  if (!hit) throw new Error(`Field "${name}" has unknown variant ${String(variant)}`);
  return hit;
}

/** Bitmap (bit i = verifier i) → boolean[3]. */
export function bits(mask: number, n = 3): boolean[] {
  return Array.from({ length: n }, (_, i) => (mask & (1 << i)) !== 0);
}

const ESTATE_STATUS = ["Active", "DeathPending", "Unlocked", "Frozen"] as const satisfies readonly EstateStatus[];
const CATEGORY = ["Tuition", "Accommodation", "Books", "Medical", "General"] as const satisfies readonly Category[];
const PAYEE_KIND = ["University", "School", "Landlord", "Other"] as const satisfies readonly PayeeKind[];
const VERDICT = ["Pending", "Approved", "Rejected"] as const satisfies readonly Verdict[];
const CLAIM_STATUS = ["Open", "Paid", "Rejected"] as const satisfies readonly ClaimStatus[];
const ASSET_STATUS = ["Held", "Listed", "Sold"] as const satisfies readonly AssetStatus[];
const HARDSHIP_STATUS = ["Open", "Approved", "Rejected"] as const satisfies readonly HardshipStatus[];

export interface OffChainNames {
  ownerName?: string;
  verifierNames?: [string, string, string];
  assetTitles?: Record<string, string>; // nft mint → title
  buyerNames?: Record<string, string>;
}

export function decodeEstate(address: string, r: Raw, vaultBalance: bigint, names: OffChainNames = {}): Estate {
  const verifiers = field(r, "verifiers");
  if (!Array.isArray(verifiers) || verifiers.length !== 3) throw new Error("Estate.verifiers must have 3 entries");
  const v = verifiers.map((x) => (isKey(x) ? x.toBase58() : String(x))) as [string, string, string];
  const pendingSince = num(r, "death_pending_since");
  return {
    address,
    owner: key(r, "owner"),
    ownerName: names.ownerName ?? "Estate owner",
    agent: key(r, "agent"),
    usdtMint: key(r, "usdt_mint"),
    verifiers: v,
    verifierNames: names.verifierNames ?? ["Verifier 1", "Verifier 2", "Verifier 3"],
    deathThreshold: num(r, "death_threshold"),
    claimThreshold: num(r, "claim_threshold"),
    hardshipThreshold: num(r, "hardship_threshold"),
    waitingPeriodSecs: num(r, "waiting_period_secs"),
    status: enumOf(r, "status", ESTATE_STATUS),
    willHash: nullIfZero(hex(r, "will_hash")),
    vaultBalance,
    death: {
      certHash: nullIfZero(hex(r, "death_cert_hash")),
      submittedBy: (() => { const s = key(r, "death_submitted_by"); return s === "11111111111111111111111111111111" ? null : s; })(),
      verdict: enumOf(r, "death_verdict", VERDICT),
      attestations: bits(num(r, "death_attestations")),
      pendingSince: pendingSince > 0 ? pendingSince : null,
    },
    lastHeartbeat: num(r, "last_heartbeat"),
  };
}

export function ruleCount(r: Raw): number { return num(r, "rule_count"); }

export const decodeBeneficiary = (address: string, r: Raw): Beneficiary => ({
  address, wallet: key(r, "wallet"), label: str(r, "label"), active: bool(r, "active"),
});

export const decodePayee = (address: string, r: Raw): Payee => ({
  address, wallet: key(r, "wallet"), kind: enumOf(r, "kind", PAYEE_KIND), name: str(r, "name"),
});

const DEFAULT_KEY = "11111111111111111111111111111111";

export const decodeRule = (address: string, r: Raw): Rule => {
  // Living-plan fields are optional so older IDLs/accounts still decode.
  const recurringAmount = has(r, "recurring_amount") ? big(r, "recurring_amount") : 0n;
  const nextDue = has(r, "next_due") ? num(r, "next_due") : 0;
  const fixed = has(r, "fixed_payee") ? optKey(r, "fixed_payee") : null;
  return {
    address, id: num(r, "id"), beneficiary: key(r, "beneficiary"),
    category: enumOf(r, "category", CATEGORY), allowedPayeeKind: enumOf(r, "allowed_payee_kind", PAYEE_KIND),
    maxPerClaim: big(r, "max_per_claim"), lifetimeCap: big(r, "lifetime_cap"), spentTotal: big(r, "spent_total"),
    validUntil: num(r, "valid_until"),
    startsNow: has(r, "starts_now") ? bool(r, "starts_now") : false,
    recurringAmount,
    intervalSecs: has(r, "interval_secs") ? num(r, "interval_secs") : 0,
    nextDue: recurringAmount > 0n && nextDue > 0 ? nextDue : null,
    fixedPayee: fixed && fixed !== DEFAULT_KEY ? fixed : null,
  };
};

export const decodeClaim = (address: string, r: Raw): Claim => ({
  address, rule: key(r, "rule"), id: num(r, "id"), beneficiary: key(r, "beneficiary"), payee: key(r, "payee"),
  amount: big(r, "amount"), evidenceHash: hex(r, "evidence_hash"), agentVerdict: enumOf(r, "agent_verdict", VERDICT),
  approvals: bits(num(r, "approvals")), ownerApproved: has(r, "owner_approved") ? bool(r, "owner_approved") : false,
  status: enumOf(r, "status", CLAIM_STATUS), createdAt: num(r, "created_at"),
});

export const decodeAsset = (address: string, r: Raw, title?: string): Asset => {
  const listingEnds = num(r, "listing_ends");
  return {
    address, nftMint: key(r, "nft_mint"), title: title ?? "Vehicle (digital title)",
    floorPrice: big(r, "floor_price"), hardshipFloor: big(r, "hardship_floor"), askingPrice: big(r, "asking_price"),
    proceedsTo: key(r, "proceeds_to"), status: enumOf(r, "status", ASSET_STATUS),
    listingEnds: listingEnds > 0 ? listingEnds : null, docHash: hex(r, "doc_hash"),
    hardshipBeneficiary: optKey(r, "hardship_beneficiary"),
  };
};

export const decodeOffer = (address: string, r: Raw, buyerName?: string): Offer => ({
  address, asset: key(r, "asset"), buyer: key(r, "buyer"), buyerName, amount: big(r, "amount"), createdAt: num(r, "created_at"),
});

export const decodeHardship = (address: string, r: Raw): Hardship => ({
  address, asset: key(r, "asset"), beneficiary: key(r, "beneficiary"), evidenceHash: hex(r, "evidence_hash"),
  agentVerdict: enumOf(r, "agent_verdict", VERDICT), approvals: bits(num(r, "approvals")),
  status: enumOf(r, "status", HARDSHIP_STATUS),
});
