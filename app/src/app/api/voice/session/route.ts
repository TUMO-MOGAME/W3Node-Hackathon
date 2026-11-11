import { z } from "zod";
import { handler, HttpError, json, rateLimit } from "@/lib/api/http";
import { authJson } from "@/lib/legacy/server/http";
import { session as legacySession } from "@/lib/legacy/server/service";

/**
 * GET /api/voice/session → { signedUrl } for @elevenlabs/client (WebSocket). Uses ELEVENLABS_API_KEY and
 * ELEVENLABS_AGENT_ID server-side only (ElevenLabs GET /v1/convai/conversation/get-signed-url, header xi-api-key).
 * 503 { code: "unavailable" } when voice is not configured, so the UI falls back to text chat.
 */
export const GET = handler(async (req) => {
  rateLimit(req, "voice-session", 10);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) throw new HttpError(503, "Voice is not configured.", "unavailable");
  const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`;
  const res = await fetch(url, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new HttpError(502, `Voice service error (${res.status}).`, "upstream");
  const data = (await res.json()) as { signed_url?: string };
  if (!data.signed_url) throw new HttpError(502, "Voice service returned no session.", "upstream");
  return json({ signedUrl: data.signed_url });
});

/**
 * POST /api/voice/session { mode: "legacy", previewChildId? } (+ x-heirloom-auth) → { signedUrl, consentedAt } for a
 * call in the parent's cloned voice. The server verifies the child (wallet signature + on-chain beneficiary),
 * the unlock and their opt-in, refreshes the estate's private ElevenLabs agent (voice id, persona prompt from the
 * Legacy Book, disclosure first message) and returns only a signed URL: the voice id never reaches the browser.
 */
export const POST = handler(async (req) => {
  rateLimit(req, "voice-session-legacy", 6);
  const { body, viewer } = await authJson(req, "session", z.object({ mode: z.literal("legacy"), previewChildId: z.string().regex(/^[a-z0-9-]{1,32}$/).optional() }));
  const s = await legacySession(viewer, viewer.role === "owner" ? body.previewChildId : undefined);
  return json({ signedUrl: s.signedUrl, consentedAt: s.label.consentedAt });
});
