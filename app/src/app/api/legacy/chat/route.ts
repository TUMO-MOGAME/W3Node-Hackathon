import { z } from "zod";
import { handler, json, rateLimit } from "@/lib/api/http";
import { chatMessageSchema } from "@/lib/agent/schemas";
import { saveTranscript } from "@/lib/db";
import { chat } from "@/lib/legacy/server/service";
import { authJson } from "@/lib/legacy/server/http";

export const maxDuration = 60;

const body = z.object({
  history: z.array(chatMessageSchema).min(1).max(30),
  /** Owner preview only: answer as if talking to this child. */
  previewChildId: z.string().regex(/^[a-z0-9-]{1,32}$/).optional(),
  sessionId: z.string().max(80).optional(),
}).refine((b) => b.history[b.history.length - 1].role === "user", "The last message must be the user's");

/**
 * POST /api/legacy/chat → LegacyChatReply { reply, voice, source, safety?, speakToken? } from the LegacyCompanion
 * specialist. Children: only after unlock and opt-in. Never moves money; distress → helplines, out of character.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "legacy-chat", 20);
  const { body: b, viewer } = await authJson(req, "chat", body);
  const out = await chat(viewer, b.history, viewer.role === "owner" ? b.previewChildId : undefined);
  if (b.sessionId) {
    const last = b.history[b.history.length - 1].text;
    void saveTranscript([
      { sessionId: b.sessionId, channel: "text", persona: `legacy:${viewer.role}`, estate: viewer.estate, role: "user", specialist: null, text: last },
      { sessionId: b.sessionId, channel: "text", persona: `legacy:${viewer.role}`, estate: viewer.estate, role: "agent", specialist: "LegacyCompanion", text: out.reply },
    ]);
  }
  return json(out);
});
