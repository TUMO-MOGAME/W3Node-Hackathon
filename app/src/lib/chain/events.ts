/**
 * Turns program events (spec §Events) into plain-language activity lines. No personal data: events only
 * carry pubkeys, amounts and timestamps.
 */
import { formatUsdt, shortAddress } from "../format";
import type { Raw } from "./decoders";

function pick(d: Raw, ...names: string[]): unknown {
  for (const n of names) {
    const want = n.replace(/_/g, "").toLowerCase();
    for (const k of Object.keys(d)) if (k.replace(/_/g, "").toLowerCase() === want) return d[k];
  }
  return undefined;
}

function amountOf(d: Raw): bigint | undefined {
  const v = pick(d, "amount", "price");
  if (v === undefined || v === null) return undefined;
  try { return BigInt(String(v)); } catch { return undefined; }
}

function who(d: Raw, ...names: string[]): string {
  const v = pick(d, ...names);
  return v && typeof (v as { toBase58?: () => string }).toBase58 === "function"
    ? shortAddress((v as { toBase58: () => string }).toBase58())
    : "someone";
}

const TEXT: Record<string, (d: Raw, amt?: bigint) => string> = {
  EstateCreated: () => "Estate created and USD₮ vault opened",
  WillSet: () => "Will rules signed (hash recorded on-chain)",
  DeathClaimSubmitted: (d) => `Death certificate hash submitted by ${who(d, "submitted_by", "beneficiary", "by")}`,
  DeathReviewed: (d) => `Agent reviewed the death certificate: ${pick(d, "approve", "approved") ? "no red flags" : "rejected"}`,
  DeathAttested: (d) => `Verifier ${who(d, "verifier")} attested the death`,
  DeathVetoed: () => "Owner vetoed the death claim (I'm alive)",
  EstateUnlocked: () => "Waiting period over: estate unlocked",
  ClaimSubmitted: (_d, a) => `Claim submitted${a !== undefined ? ` for ${formatUsdt(a)}` : ""}`,
  ClaimReviewed: (d) => `Agent reviewed a claim: ${pick(d, "approve", "approved") ? "approved" : "rejected"}`,
  ClaimApproved: (d) => `Verifier ${who(d, "verifier")} approved a claim`,
  ClaimPaid: (d, a) => `${a !== undefined ? formatUsdt(a) : "USD₮"} paid to ${who(d, "payee", "payee_wallet")}`,
  AssetRegistered: () => "Car digital title moved into the estate",
  AssetListed: () => "Car listed for sale",
  OfferPlaced: (d, a) => `Offer of ${a !== undefined ? formatUsdt(a) : "USD₮"} escrowed by ${who(d, "buyer")}`,
  OfferWithdrawn: (d) => `Offer withdrawn by ${who(d, "buyer")}`,
  HardshipSubmitted: () => "Hardship request submitted",
  HardshipReviewed: (d) => `Agent reviewed a hardship request: ${pick(d, "approve", "approved") ? "supported" : "rejected"}`,
  HardshipApproved: (d) => `Verifier ${who(d, "verifier")} approved a hardship request`,
  ScheduledPaid: (d, a) => `Scheduled payment of ${a !== undefined ? formatUsdt(a) : "USD₮"} paid to ${who(d, "payee", "fixed_payee", "payee_wallet")}`,
  ClaimOwnerApproved: () => "Owner approved a living-plan claim",
  AssetSold: (d, a) => `Car sold for ${a !== undefined ? formatUsdt(a) : "USD₮"} to ${who(d, "buyer")}: USD₮ and title swapped atomically`,
};

export function describeEvent(name: string, data: Raw): { kind: string; text: string; amount?: bigint } {
  const key = Object.keys(TEXT).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
  const amount = amountOf(data);
  const fn = TEXT[key];
  return { kind: key, text: fn ? fn(data, amount) : key, amount };
}
