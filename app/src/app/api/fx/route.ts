import { getUsdtZar } from "@/lib/fx";
import { handler, json, rateLimit } from "@/lib/api/http";

/** GET /api/fx → FxRate (VALR USDT/ZAR, 60 s cache, labelled fallback). */
export const GET = handler(async (req) => {
  rateLimit(req, "fx", 60);
  return json(await getUsdtZar());
});
