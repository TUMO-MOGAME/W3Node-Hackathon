/**
 * Demo scheduler: calls POST /api/scheduler/tick every 20 s so scheduled (living-plan) payments happen on their
 * own during the demo. Needs SCHEDULER_SECRET in app/.env.local and the app running.
 * Run from app/:  npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/run-scheduler.ts [http://localhost:3000]
 */
import { loadEnv } from "./_shared";

loadEnv();
const base = process.argv[2] ?? "http://localhost:3000";
const secret = process.env.SCHEDULER_SECRET;
if (!secret) { console.error("Set SCHEDULER_SECRET in app/.env.local"); process.exit(1); }

async function tick() {
  try {
    const res = await fetch(`${base}/api/scheduler/tick`, { method: "POST", headers: { "x-heirloom-scheduler-secret": secret! } });
    const data = (await res.json()) as { ran?: number; results?: { rule: string; ok: boolean; explorerUrl?: string; error?: string }[]; error?: string };
    if (!res.ok) return console.error(`[${new Date().toLocaleTimeString()}] ${res.status} ${data.error ?? ""}`);
    for (const r of data.results ?? []) console.log(`[${new Date().toLocaleTimeString()}] ${r.ok ? "paid" : "failed"} rule ${r.rule.slice(0, 6)}… ${r.explorerUrl ?? r.error ?? ""}`);
    if (!data.ran) console.log(`[${new Date().toLocaleTimeString()}] nothing due`);
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] ${(e as Error).message}`);
  }
}

void tick();
setInterval(() => void tick(), 20_000);
