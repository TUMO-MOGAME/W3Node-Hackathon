import "server-only";
/** CarBroker explanation of a deterministic ranking. The ranking itself is never changed by the model. */
import type { OfferRanking } from "../types";
import type { RankAsset } from "./offers";
import { minimumAccepted } from "./offers";
import { formatUsdt } from "../format";
import { generate, hasGemini } from "./gemini";
import { CAR_BROKER } from "./prompts";

export function plainExplanation(asset: RankAsset, r: OfferRanking): string {
  const { min, rule } = minimumAccepted(asset);
  const which = rule === "floor" ? "the owner's floor price" : "the hardship floor (a hardship request was approved)";
  if (!r.bestOffer) return `No offer reaches ${which} of ${formatUsdt(min)}, so the contract will not allow a sale yet.`;
  const best = r.eligible[0];
  return `The best offer is ${formatUsdt(best.amount)}, which meets ${which} of ${formatUsdt(min)}. ` +
    `${r.eligible.length - 1} other offer(s) qualify and ${r.ineligible.length} do not.`;
}

export async function explainRanking(asset: RankAsset & { title?: string }, r: OfferRanking): Promise<string> {
  const base = plainExplanation(asset, r);
  if (!hasGemini()) return base;
  try {
    const res = await generate({
      system: `${CAR_BROKER}\nExplain the ranking in 2-3 short sentences for the family. Do not change the result.`,
      thinking: "low",
      timeoutMs: 12_000,
      contents: [{ role: "user", parts: [{ text: `Car: ${asset.title ?? "the estate's car"}.\nFacts: ${base}\nEligible: ${r.eligible.map((e) => formatUsdt(e.amount)).join(", ") || "none"}.\nIneligible: ${r.ineligible.map((e) => `${formatUsdt(e.amount)} (${e.reason})`).join("; ") || "none"}.` }] }],
    });
    return res.text?.trim() || base;
  } catch {
    return base;
  }
}
