import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { handler, HttpError, isChainMode, json, parseJson, rateLimit } from "@/lib/api/http";
import { chatMessageSchema, localeSchema } from "@/lib/agent/schemas";
import { orchestrate, ROUTABLE } from "@/lib/agent/orchestrator";
import { estateFactsSchema, toEstateFacts, type EstateFacts } from "@/lib/agent/facts";
import { loadSnapshot } from "@/lib/server/estate";
import { saveTranscript } from "@/lib/db";

export const maxDuration = 60;

const addr = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const body = z.object({
  // Browser shape
  text: z.string().min(1).max(4000).optional(),
  history: z.array(chatMessageSchema).max(30).optional(),
  context: z.object({ persona: z.string().max(80).optional(), role: z.string().max(20).optional(), estate: addr.optional(), page: z.string().max(120).optional() }).optional(),
  facts: estateFactsSchema.optional(),
  specialist: z.enum(ROUTABLE).optional(),
  sessionId: z.string().max(80).optional(),
  // ElevenLabs webhook shape (see scripts/elevenlabs-agent.md)
  message: z.string().min(1).max(4000).optional(),
  persona: z.string().max(80).optional(),
  estate: z.string().max(64).optional(),
  page: z.string().max(120).optional(),
  conversation_id: z.string().max(80).optional(),
  // The visitor's language (both shapes); the agent replies in it.
  locale: localeSchema.optional(),
}).refine((b) => b.text || b.message || b.history?.length, "text, message or history is required");

function secretOk(given: string): boolean {
  const want = process.env.ELEVENLABS_TOOL_SECRET ?? "";
  if (!want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/agent/orchestrate → { specialist, reply, actions[], draft?, needsHuman?, routedBy }.
 * Callers: the in-app text chat (rate-limited per IP) and the ElevenLabs agent's server tool
 * (must send header `x-heirloom-tool-secret: $ELEVENLABS_TOOL_SECRET`).
 */
export const POST = handler(async (req) => {
  const secret = req.headers.get("x-heirloom-tool-secret");
  const channel = secret !== null ? "voice" : "text";
  if (secret !== null && !secretOk(secret)) throw new HttpError(401, "Bad tool secret", "unauthorized");
  rateLimit(req, `orchestrate-${channel}`, channel === "voice" ? 120 : 20);

  const b = await parseJson(req, body);
  const userText = b.text ?? b.message;
  const history = [...(b.history ?? []), ...(userText ? [{ role: "user" as const, text: userText }] : [])].slice(-20);
  const persona = b.context?.persona ?? b.persona;
  const estateAddr = b.context?.estate ?? (b.estate && addr.safeParse(b.estate).success ? b.estate : undefined);
  const role = b.context?.role ?? persona?.split(":")[0];

  let facts: EstateFacts | null = b.facts ?? null;
  if (!facts && estateAddr && isChainMode()) facts = await loadSnapshot(estateAddr).then(toEstateFacts).catch(() => null);

  const result = await orchestrate({ history, facts, context: { persona, role, page: b.context?.page ?? b.page, channel, locale: b.locale } }, b.specialist);

  const sessionId = b.sessionId ?? b.conversation_id;
  if (sessionId && userText) {
    void saveTranscript([
      { sessionId, channel, persona: persona ?? null, estate: estateAddr ?? null, role: "user", specialist: null, text: userText },
      { sessionId, channel, persona: persona ?? null, estate: estateAddr ?? null, role: "agent", specialist: result.specialist, text: result.reply },
    ]);
  }
  return json(result);
});
