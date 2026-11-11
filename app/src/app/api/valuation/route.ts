import { handler, json, parseJson, rateLimit } from "@/lib/api/http";
import { valuationBody } from "@/lib/agent/schemas";
import { valueCar } from "@/lib/agent/valuation";

export const maxDuration = 90;

/** POST /api/valuation { make, model, year, mileageKm, condition } → CarValuation (CarBroker, Search grounding). */
export const POST = handler(async (req) => {
  rateLimit(req, "valuation", 6);
  return json(await valueCar(await parseJson(req, valuationBody)));
});
