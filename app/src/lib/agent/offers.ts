/**
 * Deterministic offer ranking. Mirrors accept_offer in the program: if a hardship request was approved
 * (asset.hardshipBeneficiary set) the minimum is the hardship floor, otherwise the floor price.
 * Best = highest eligible amount; ties go to the earliest offer. Gemini only writes the explanation.
 * Pure TS, no server deps (unit-tested).
 */
import type { Base58, OfferRanking } from "../types";
import { formatUsdt } from "../format";

export interface RankAsset {
  floorPrice: bigint;
  hardshipFloor: bigint;
  hardshipBeneficiary: Base58 | null;
  status: "Held" | "Listed" | "Sold";
}
export interface RankOffer { address: Base58; buyer: Base58; amount: bigint; createdAt: number }

export function minimumAccepted(asset: RankAsset): { min: bigint; rule: "floor" | "hardship_floor" } {
  return asset.hardshipBeneficiary
    ? { min: asset.hardshipFloor, rule: "hardship_floor" }
    : { min: asset.floorPrice, rule: "floor" };
}

export function rankOffers(asset: RankAsset, offers: RankOffer[]): OfferRanking {
  const { min, rule } = minimumAccepted(asset);
  const label = rule === "floor" ? "floor price" : "hardship floor";
  const sorted = [...offers].sort((a, b) => (a.amount === b.amount ? a.createdAt - b.createdAt : a.amount > b.amount ? -1 : 1));
  const eligible: OfferRanking["eligible"] = [];
  const ineligible: OfferRanking["ineligible"] = [];
  for (const o of sorted) {
    if (asset.status !== "Listed") {
      ineligible.push({ offer: o.address, amount: o.amount, reason: `The car is ${asset.status.toLowerCase()}, not listed for sale.` });
    } else if (o.amount <= 0n) {
      ineligible.push({ offer: o.address, amount: o.amount, reason: "Offer amount must be more than zero." });
    } else if (o.amount >= min) {
      eligible.push({ offer: o.address, amount: o.amount, reason: `At or above the ${label} of ${formatUsdt(min)}.` });
    } else {
      ineligible.push({ offer: o.address, amount: o.amount, reason: `Below the ${label} of ${formatUsdt(min)} by ${formatUsdt(min - o.amount)}.` });
    }
  }
  return { bestOffer: eligible[0]?.offer ?? null, eligible, ineligible };
}
