import { z } from "zod";
import { handler, json, rateLimit } from "@/lib/api/http";
import { speak } from "@/lib/legacy/server/service";
import { authJson } from "@/lib/legacy/server/http";

export const maxDuration = 30;

const body = z.union([
  z.object({ milestoneId: z.string().regex(/^[a-z0-9-]{1,40}$/) }),
  z.object({ text: z.string().min(1).max(1500), token: z.string().max(200).optional() }),
]);

/**
 * POST /api/legacy/speak { milestoneId } | { text, token } → audio/mpeg in the parent's voice
 * (or JSON { simulated: true, text } when no ElevenLabs voice exists, so the browser speaks it instead).
 * Only words from the Legacy Book: a milestone the owner wrote, a companion reply carrying a server token from
 * /api/legacy/chat, or the owner previewing ≤ OWNER_PREVIEW_MAX chars. Rate limits: 20/min per IP, 200/day per estate.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "legacy-speak", 20);
  const { body: b, viewer } = await authJson(req, "speak", body);
  const out = await speak(viewer, b);
  if (!out.audio) return json({ simulated: true, text: out.text });
  return new Response(out.audio as BodyInit, { headers: { "content-type": "audio/mpeg", "cache-control": "private, no-store", "x-legacy-voice": "parent" } });
});

