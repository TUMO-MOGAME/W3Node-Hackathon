/**
 * Runs Heirloom's wallet-assistant parser fully on this machine with Tether QVAC (@qvac/sdk), with no Next.js
 * server and no network after the one-time model download. Same code path as POST /api/assistant/qvac:
 * QVAC (json_schema-constrained) → zod → grounded against the deterministic parser → planSend (recipient + rate).
 *
 * Run from app/:
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/qvac-local.ts "send R500 to Lerato for books"
 *   (or: npm run qvac:local -- "pay Sipho 20 USDT")
 * Options via env: QVAC_MODEL (default QWEN3_600M_INST_Q4), QVAC_TIMEOUT_MS, FX (USD₮→ZAR, default 18.5).
 * First run downloads the model (a few hundred MB) into QVAC's cache; later runs start from disk.
 */
import { interpret, qvacStatus, warmQvac } from "../app/src/lib/assistant/qvac";
import { parseIntentFallback, planSend, type RecipientLike } from "../app/src/lib/assistant/intent";

process.env.QVAC_ENABLED ??= "1";

const DEMO: RecipientLike[] = [
  { label: "Lerato Mokoena", address: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T", relationship: "daughter, 20" },
  { label: "Sipho Mokoena", address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", relationship: "son, 18" },
  { label: "Naledi Mokoena", address: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH", relationship: "daughter, 15" },
  { label: "Adv. Thandi Ndlovu", address: "2wmVCSfPxGPjrnMMn7rchp4uaeoTqN39mXFC2zhPdri9", relationship: "executor" },
];

async function main() {
  const inputs = process.argv.slice(2);
  const texts = inputs.length ? inputs : ["send R500 to Lerato for books", "pay Sipho 20 USDT for taxi fare", "give my daughter 300 rand"];
  const rate = Number(process.env.FX ?? 18.5);

  console.log(`▸ Tether QVAC model ${qvacStatus().model}: loading (first run downloads it)…`);
  const t0 = Date.now();
  const timer = setInterval(() => process.stderr.write(`\r▸ ${qvacStatus().progress}%   `), 1000);
  try {
    await warmQvac();
    clearInterval(timer);
    console.log(`\n▸ Loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s. Inference runs on this device.\n`);
  } catch (e) {
    clearInterval(timer);
    console.error(`\n✖ QVAC could not load: ${e instanceof Error ? e.message : e}`);
    console.error("  Showing the deterministic fallback parser instead (same schema).\n");
    for (const text of texts) {
      const intent = parseIntentFallback(text, DEMO);
      console.log(JSON.stringify({ text, engine: "fallback", intent, plan: planSend(intent, DEMO, rate) }, null, 2));
    }
    process.exit(1);
  }

  for (const text of texts) {
    const r = await interpret(text, DEMO);
    console.log(JSON.stringify({ text, engine: r.engine, model: r.model, ms: r.ms, note: r.note, intent: r.intent, plan: planSend(r.intent, DEMO, rate) }, null, 2));
  }
  process.exit(0); // the SDK keeps its Bare worker alive; exit explicitly
}

void main();
