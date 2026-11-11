import { z } from "zod";
import { handler, json, rateLimit } from "@/lib/api/http";
import { getReports } from "@/lib/db";

const hashes = z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(100);

/** GET /api/reports?hashes=h1,h2 → { [reportHash]: AgentReport } (reports are linked by the on-chain hash). */
export const GET = handler(async (req) => {
  rateLimit(req, "reports", 60);
  const q = new URL(req.url).searchParams.get("hashes") ?? "";
  return json(await getReports(hashes.parse(q ? q.split(",") : [])));
});
