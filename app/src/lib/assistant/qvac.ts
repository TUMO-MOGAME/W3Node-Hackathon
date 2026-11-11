/**
 * Server/Node only (used by /api/assistant/qvac and scripts/qvac-local.ts). It has no "server-only" import so
 * the plain-Node script can load it; it holds no secrets and refuses to run in a browser.
 *
 * Tether QVAC adapter: on-device LLM inference with @qvac/sdk (Node.js; the SDK starts its own Bare worker).
 * The model runs on this machine. Nothing is sent to a cloud AI API. Sampling is constrained to
 * WALLET_INTENT_JSON_SCHEMA (`responseFormat: json_schema`), then zod-validated and grounded against the
 * deterministic parser so an invented amount or person can never reach the review sheet.
 *
 * When QVAC is unavailable (hosted serverless demo, package not installed, model still downloading, or a
 * slow/failed completion) the caller gets the deterministic fallback with the same schema, labelled as such.
 *
 * Env:
 *   QVAC_ENABLED=1|0   default: on locally, off on Vercel (the model is too large for a serverless function)
 *   QVAC_MODEL         a model constant exported by @qvac/sdk (default QWEN3_600M_INST_Q4)
 *   QVAC_TIMEOUT_MS    per-request budget before falling back (default 20000)
 */
import { groundIntent, parseIntentFallback, walletIntentSchema, WALLET_INTENT_JSON_SCHEMA, type IntentEngine, type RecipientLike, type WalletIntent } from "./intent";

export const DEFAULT_QVAC_MODEL = "QWEN3_600M_INST_Q4";

/** The few @qvac/sdk exports we use (typed here so the app builds where the optional package is absent). */
interface QvacRun { events: AsyncIterable<{ type: string; text?: string }>; final: Promise<{ contentText: string }> }
interface QvacSdk {
  loadModel(opts: { modelSrc: unknown; onProgress?: (p: { percentage: number }) => void }): Promise<string>;
  completion(opts: { modelId: string; history: { role: string; content: string }[]; stream: boolean; responseFormat?: unknown }): QvacRun;
  [constant: string]: unknown;
}

export interface QvacStatus { enabled: boolean; state: "off" | "idle" | "loading" | "ready" | "error"; model: string; progress: number; error?: string }

const state: { sdk: QvacSdk | null; modelId: string | null; loading: Promise<string> | null; progress: number; error?: string } = {
  sdk: null, modelId: null, loading: null, progress: 0,
};

export function qvacEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.QVAC_ENABLED === "1") return true;
  if (env.QVAC_ENABLED === "0") return false;
  return !env.VERCEL;
}

const modelName = () => process.env.QVAC_MODEL || DEFAULT_QVAC_MODEL;

export function qvacStatus(): QvacStatus {
  const enabled = qvacEnabled();
  return {
    enabled, model: modelName(), progress: state.progress, error: state.error,
    state: !enabled ? "off" : state.modelId ? "ready" : state.loading ? "loading" : state.error ? "error" : "idle",
  };
}

// A non-analysable import keeps the optional native package out of the server bundle and out of
// Vercel's file tracing (its prebuilt engines are far larger than a serverless function may be).
const importOptional = new Function("s", "return import(s)") as (s: string) => Promise<unknown>;

async function sdk(): Promise<QvacSdk> {
  if (state.sdk) return state.sdk;
  if (typeof window !== "undefined") throw new Error("QVAC runs in Node, not in the browser");
  let mod: QvacSdk & { default?: QvacSdk };
  try {
    mod = (await importOptional("@qvac/sdk")) as typeof mod;
  } catch {
    // Code built by `new Function` has no referrer; resolve from the app folder explicitly instead.
    const { pathToFileURL } = (await importOptional("node:url")) as typeof import("node:url");
    const { createRequire } = (await importOptional("node:module")) as typeof import("node:module");
    const entry = createRequire(`${process.cwd()}/package.json`).resolve("@qvac/sdk");
    mod = (await importOptional(pathToFileURL(entry).href)) as typeof mod;
  }
  state.sdk = typeof mod.loadModel === "function" ? mod : (mod.default as QvacSdk);
  return state.sdk;
}

/** Loads (and on first run downloads) the model once per process. Safe to call repeatedly. */
export function warmQvac(): Promise<string> {
  if (state.modelId) return Promise.resolve(state.modelId);
  if (!state.loading) {
    state.error = undefined;
    state.loading = (async () => {
      const q = await sdk();
      const src = q[modelName()];
      if (!src) throw new Error(`@qvac/sdk has no model constant ${modelName()}`);
      const id = await q.loadModel({ modelSrc: src, onProgress: (p) => { state.progress = Math.round(p.percentage); } });
      state.modelId = id;
      state.progress = 100;
      return id;
    })().catch((e: unknown) => {
      state.error = e instanceof Error ? e.message.slice(0, 200) : "QVAC failed to load";
      throw e;
    }).finally(() => { state.loading = null; });
  }
  return state.loading;
}

export function buildMessages(text: string, recipients: RecipientLike[]): { role: string; content: string }[] {
  const names = recipients.map((r) => `${r.label}${r.relationship ? ` (${r.relationship})` : ""}`).join("; ") || "none saved";
  return [
    {
      role: "system",
      content: [
        "You read one wallet request and return JSON only. /no_think",
        "action: \"send\" if the person wants to send, pay, give or transfer money; otherwise \"unknown\".",
        "recipient: the person's name exactly as written, or a wallet address; null if missing.",
        "amountZar: the amount if written in rand (R, ZAR, rand). amountUsdt: the amount if written in USDT, USD₮, USD, $ or dollars, or with no currency.",
        "Set only one amount; the other is null. Never guess an amount that is not in the request.",
        "memo: what the money is for (the words after \"for\"), or null.",
        `Saved recipients: ${names}.`,
      ].join("\n"),
    },
    { role: "user", content: "pay Sipho 20 USDT for taxi fare" },
    { role: "assistant", content: JSON.stringify({ action: "send", recipient: "Sipho", amountUsdt: 20, amountZar: null, memo: "taxi fare" }) },
    { role: "user", content: text.slice(0, 500) },
  ];
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function complete(text: string, recipients: RecipientLike[]): Promise<WalletIntent> {
  const q = await sdk();
  const modelId = await warmQvac();
  const run = q.completion({
    modelId, history: buildMessages(text, recipients), stream: true,
    responseFormat: { type: "json_schema", json_schema: { name: "wallet_intent", schema: WALLET_INTENT_JSON_SCHEMA } },
  });
  for await (const ev of run.events) void ev; // drain the stream; the aggregated text arrives on `final`
  const out = (await run.final).contentText.trim();
  return walletIntentSchema.parse(JSON.parse(out));
}

export interface ParsedRequest { intent: WalletIntent; engine: IntentEngine; model: string | null; note: string; ms: number }

/** QVAC first (when enabled and loaded in time), deterministic fallback otherwise. Same schema either way. */
export async function interpret(text: string, recipients: RecipientLike[]): Promise<ParsedRequest> {
  const start = Date.now();
  const fallback = (note: string): ParsedRequest => ({ intent: parseIntentFallback(text, recipients), engine: "fallback", model: null, note, ms: Date.now() - start });
  if (!qvacEnabled()) return fallback("QVAC runs locally. The hosted demo uses the fallback parser.");
  const budget = Number(process.env.QVAC_TIMEOUT_MS ?? 20_000);
  try {
    if (!state.modelId) {
      // First request: start the download/load in the background and answer with the fallback meanwhile.
      void warmQvac().catch(() => undefined);
      await timeout(warmQvac(), Math.min(budget, 3000));
    }
    const model = await timeout(complete(text, recipients), budget);
    return { intent: groundIntent(model, text, recipients), engine: "qvac", model: modelName(), note: "Read on this device by Tether QVAC.", ms: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (state.loading) return fallback(`QVAC is still loading the model (${state.progress}%). Used the fallback parser.`);
    if (/Cannot find (module|package)|ERR_MODULE_NOT_FOUND/i.test(msg)) return fallback("QVAC is not installed here. Used the fallback parser.");
    return fallback(msg === "timeout" ? "QVAC took too long. Used the fallback parser." : "QVAC could not read that. Used the fallback parser.");
  }
}
