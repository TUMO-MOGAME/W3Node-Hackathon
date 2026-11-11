import { z } from "zod";
import { handler, HttpError, isChainMode, json, parseJson, rateLimit } from "@/lib/api/http";
import { rankOffersBody } from "@/lib/agent/schemas";
import { rankOffers, type RankAsset, type RankOffer } from "@/lib/agent/offers";
import { explainRanking } from "@/lib/agent/explain";
import { loadSnapshot } from "@/lib/server/estate";

const addr = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const byAddress = z.object({ estate: addr, asset: addr, explain: z.boolean().optional() });

/**
 * POST /api/rank-offers
 *  - { estate, asset } (chain mode: offers read from chain), or
 *  - { asset: {...}, offers: [...] } (any mode; amounts as base-unit strings)
 * → OfferRanking + explanation. Ranking is deterministic TS (same rule as accept_offer); Gemini only explains.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "rank-offers", 20);
  const raw: unknown = await req.clone().json().catch(() => null);
  let asset: RankAsset & { title?: string };
  let offers: RankOffer[];
  let explain = true;
  if (byAddress.safeParse(raw).success) {
    if (!isChainMode()) throw new HttpError(400, "Pass the asset and offers in mock mode.");
    const b = await parseJson(req, byAddress);
    const snap = await loadSnapshot(b.estate);
    const a = snap.assets.find((x) => x.address === b.asset);
    if (!a) throw new HttpError(404, "Asset not found in this estate.");
    asset = a;
    offers = snap.offers.filter((o) => o.asset === a.address);
    explain = b.explain ?? true;
  } else {
    const b = await parseJson(req, rankOffersBody);
    asset = b.asset;
    offers = b.offers;
    explain = b.explain ?? true;
  }
  const ranking = rankOffers(asset, offers);
  const explanation = explain ? await explainRanking(asset, ranking) : null;
  return json({ ...ranking, explanation });
});
