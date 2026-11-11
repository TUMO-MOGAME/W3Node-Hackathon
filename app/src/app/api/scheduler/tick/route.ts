import { timingSafeEqual } from "node:crypto";
import { handler, HttpError, isChainMode, json, rateLimit } from "@/lib/api/http";
import { hasAgentWallet } from "@/lib/agent/agent-wallet";
import { runDueSchedules } from "@/lib/server/scheduler";

export const maxDuration = 60;

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Accepts `x-heirloom-scheduler-secret: $SCHEDULER_SECRET` or Vercel Cron's `Authorization: Bearer $CRON_SECRET`. */
function authorize(req: Request): void {
  const s = process.env.SCHEDULER_SECRET, c = process.env.CRON_SECRET;
  const header = req.headers.get("x-heirloom-scheduler-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if ((s && header && same(header, s)) || (c && bearer && same(bearer, c))) return;
  throw new HttpError(401, "Not authorised", "unauthorized");
}

async function tick(req: Request): Promise<Response> {
  rateLimit(req, "scheduler", 30);
  authorize(req);
  if (!isChainMode()) return json({ ran: 0, results: [], note: "mock mode: nothing to execute" });
  if (!hasAgentWallet()) throw new HttpError(503, "The agent wallet is not configured (AGENT_SEED_PHRASE).");
  const results = await runDueSchedules();
  return json({ ran: results.length, results });
}

/** POST /api/scheduler/tick → executes due scheduled (recurring) payments; the agent's WDK wallet pays fees. */
export const POST = handler(tick);
/** GET for Vercel Cron (same auth). */
export const GET = handler(tick);
