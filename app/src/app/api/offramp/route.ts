import { z } from "zod";
import { handler, json, parseJson, rateLimit } from "@/lib/api/http";
import { SimulatedZarPayout } from "@/lib/offramp";
import { getUsdtZar } from "@/lib/fx";
import { toBase } from "@/lib/format";

const body = z.object({
  claimTx: z.string().min(16).max(120), amountUsdt: z.number().positive().max(10_000_000),
  institutionName: z.string().min(1).max(80), reference: z.string().max(60).default("Heirloom claim"),
});

/** POST /api/offramp → SIMULATED ZAR payout quote for a paid claim (Luno Settlements / Stables in production). */
export const POST = handler(async (req) => {
  rateLimit(req, "offramp", 30);
  const b = await parseJson(req, body);
  const quote = await new SimulatedZarPayout().quote({ ...b, amountBase: toBase(b.amountUsdt) }, await getUsdtZar());
  return json(quote);
});
