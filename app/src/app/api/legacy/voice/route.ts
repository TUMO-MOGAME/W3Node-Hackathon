import { handler, HttpError, isChainMode, json, rateLimit } from "@/lib/api/http";
import { authorize, demoWritesAllowed } from "@/lib/legacy/server/auth";
import { hasElevenLabs } from "@/lib/legacy/server/elevenlabs";
import { createVoice, readUpload, removeVoice, uploadHash } from "@/lib/legacy/server/service";
import { authEmpty } from "@/lib/legacy/server/http";
import { MAX_SAMPLES, MAX_TOTAL_BYTES } from "@/lib/legacy/schema";

export const maxDuration = 60;

/**
 * GET /api/legacy/voice → capabilities only (no personal data): { elevenlabs, available } so the app can choose
 * between the real voice and the clearly labelled simulated one.
 */
export const GET = handler(async (req) => {
  rateLimit(req, "legacy-probe", 60);
  return json({ elevenlabs: hasElevenLabs(), available: isChainMode() || demoWritesAllowed() });
});

/**
 * POST /api/legacy/voice (multipart, owner only, estate must be Active):
 *   ownerName, consentText (exact consent line), consentAccepted=true, consent (audio of the line), samples (3–8 audio)
 * → LegacyVoiceInfo. Creates an ElevenLabs Instant Voice Clone (or a simulated voice without a key).
 * Limits: 3 recordings per minute per IP; ≤ 3 MB per recording, ≤ 4 MB per request (Vercel body limit).
 */
export const POST = handler(async (req) => {
  rateLimit(req, "legacy-voice-create", 3);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_TOTAL_BYTES + 64 * 1024) throw new HttpError(413, "The recordings are too large together.");
  const form = await req.formData().catch(() => { throw new HttpError(400, "Expected a form upload."); });
  const str = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : ""; };
  const consent = form.get("consent");
  const samples = form.getAll("samples").filter((f): f is File => f instanceof File).slice(0, MAX_SAMPLES + 1);
  const upload = { ownerName: str("ownerName"), consentText: str("consentText"), consentAccepted: str("consentAccepted") === "true", consent: consent instanceof File ? consent : null, samples };
  const files = await readUpload(upload);
  const viewer = await authorize(req, "voice.create", await uploadHash({
    ownerName: upload.ownerName, consentText: upload.consentText, consentSha: files.consent.sha, sampleShas: files.samples.map((s) => s.sha),
  }), ["owner"]);
  return json(await createVoice(viewer, upload, files));
});

/** DELETE /api/legacy/voice → deletes the voice at ElevenLabs (voice + agent), the recordings and rendered messages. */
export const DELETE = handler(async (req) => {
  rateLimit(req, "legacy-voice-delete", 5);
  const viewer = await authEmpty(req, "voice.delete", ["owner"]);
  await removeVoice(viewer);
  return json({ ok: true });
});

