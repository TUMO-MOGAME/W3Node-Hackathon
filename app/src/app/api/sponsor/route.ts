import { z } from "zod";
import { handler, HttpError, isChainMode, json, parseJson, rateLimit } from "@/lib/api/http";
import { SponsorRejection } from "@/lib/sponsor/policy";
import { SimulationFailed, SponsorLimited, SponsorUnavailable, sponsorInfo, sponsorTransaction } from "@/lib/sponsor/server";

export const maxDuration = 30;

/** GET /api/sponsor → { available, feePayer, maxFeeLamports, paysRent } so the client can build sponsored txs. */
export const GET = handler(async (req) => {
  rateLimit(req, "sponsor-info", 60);
  if (!isChainMode()) return json({ available: false, feePayer: null, maxFeeLamports: 0, paysRent: false, reason: "mock mode" });
  const { balanceLamports: _b, ...info } = await sponsorInfo();
  void _b;
  return json(info);
});

const body = z.object({
  /** base64 legacy wire tx: fee payer = sponsor (empty slot), every other signer already signed. */
  tx: z.string().min(100).max(2_000),
  /** false (pay-once pipeline): co-sign and return the bytes; the client stores them, then broadcasts. */
  submit: z.boolean().default(true),
});

/**
 * POST /api/sponsor { tx, submit? } → { signature, wireBase64, feeLamports, rentLamports, submitted }.
 * The agent's WDK wallet co-signs as fee payer only after lib/sponsor/policy.ts accepts the exact bytes.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "sponsor", 20);
  if (!isChainMode()) throw new HttpError(503, "Fee sponsorship needs chain mode.", "unavailable");
  const { tx, submit } = await parseJson(req, body, 8_000);
  try {
    return json(await sponsorTransaction(tx, { submit }));
  } catch (e) {
    if (e instanceof SponsorRejection) throw new HttpError(422, e.message, `rejected:${e.code}`);
    if (e instanceof SponsorLimited) throw new HttpError(429, e.message, "rate_limited");
    if (e instanceof SponsorUnavailable) throw new HttpError(503, e.message, "unavailable");
    if (e instanceof SimulationFailed) throw new HttpError(422, e.message, "simulation_failed");
    throw e;
  }
});
