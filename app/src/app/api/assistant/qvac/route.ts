import { z } from "zod";
import { handler, json, parseJson, rateLimit } from "@/lib/api/http";
import { interpret, qvacStatus } from "@/lib/assistant/qvac";

/** QVAC needs Node (it spawns a Bare worker with native llama.cpp); never the edge runtime. */
export const runtime = "nodejs";
export const maxDuration = 30;

const body = z.object({
  text: z.string().trim().min(1).max(500),
  recipients: z.array(z.object({
    label: z.string().max(80),
    address: z.string().max(64),
    relationship: z.string().max(60).optional(),
  })).max(50).default([]),
});

/**
 * POST /api/assistant/qvac { text, recipients } → { intent, engine: "qvac" | "fallback", model, note, ms }.
 * Only reads the request. It never sends anything: the app resolves the intent and opens the payment review.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "assistant-qvac", 30);
  const { text, recipients } = await parseJson(req, body, 20_000);
  return json(await interpret(text, recipients));
});

/** GET → whether QVAC is on here and the model's load state (for docs and the local check). */
export const GET = handler(async (req) => {
  rateLimit(req, "assistant-qvac-status", 60);
  return json(qvacStatus());
});
