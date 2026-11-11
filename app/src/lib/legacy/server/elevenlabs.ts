import "server-only";
/**
 * ElevenLabs REST calls for Legacy Voice (xi-api-key header, server only). Endpoints (checked Nov 2026):
 *  - Instant Voice Cloning   POST   /v1/voices/add                (multipart: name, files[], remove_background_noise,
 *                                                                  description, labels) → { voice_id, requires_verification }
 *  - Delete voice            DELETE /v1/voices/{voice_id}
 *  - Text to speech          POST   /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128 { text, model_id, voice_settings }
 *  - Legacy agent            POST   /v1/convai/agents/create      { name, conversation_config, platform_settings }
 *                            PATCH  /v1/convai/agents/{agent_id}  (prompt refreshed per call with the verified child + status)
 *                            DELETE /v1/convai/agents/{agent_id}
 *  - Signed URL              GET    /v1/convai/conversation/get-signed-url?agent_id=…
 * Why a per-estate agent instead of client overrides: overrides are sent by the browser, so tts.voice_id and the
 * persona prompt would be visible to (and changeable by) the client. A private agent keeps both server-side.
 */
const BASE = "https://api.elevenlabs.io";

export const hasElevenLabs = () => Boolean(process.env.ELEVENLABS_API_KEY);
const key = () => {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ElevenLabs is not configured.");
  return k;
};

export class ElevenLabsError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ElevenLabsError"; }
}

async function call(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "xi-api-key": key(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Never echo request bodies; the detail is ElevenLabs' validation message only.
    throw new ElevenLabsError(res.status, `ElevenLabs ${init.method ?? "GET"} ${path.split("?")[0].replace(/\/[A-Za-z0-9_-]{16,}/g, "/…")} failed (${res.status}) ${detail.slice(0, 200)}`);
  }
  return res;
}

export async function createInstantVoice(input: { name: string; description: string; files: { bytes: Uint8Array; mime: string; name: string }[] }): Promise<{ voiceId: string; requiresVerification: boolean }> {
  const form = new FormData();
  form.set("name", input.name);
  form.set("description", input.description);
  form.set("remove_background_noise", "true");
  form.set("labels", JSON.stringify({ use: "heirloom-legacy", accent: "south african" }));
  for (const f of input.files) form.append("files", new Blob([f.bytes as BlobPart], { type: f.mime }), f.name);
  const res = await call("/v1/voices/add", { method: "POST", body: form, timeoutMs: 60_000 });
  const data = (await res.json()) as { voice_id?: string; requires_verification?: boolean };
  if (!data.voice_id) throw new ElevenLabsError(502, "ElevenLabs returned no voice.");
  return { voiceId: data.voice_id, requiresVerification: Boolean(data.requires_verification) };
}

export async function deleteElevenVoice(voiceId: string): Promise<void> {
  try { await call(`/v1/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" }); }
  catch (e) { if (!(e instanceof ElevenLabsError && e.status === 404)) throw e; }
}

export async function textToSpeech(voiceId: string, text: string): Promise<Uint8Array> {
  const res = await call(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
      voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.1, use_speaker_boost: true },
    }),
  });
  return new Uint8Array(await res.arrayBuffer());
}

/** Label the legacy agent uses to switch to Heirloom's own voice (multi-voice), when a default voice is configured. */
export const HEIRLOOM_VOICE_TAG = "Heirloom";
export const heirloomVoiceId = () => process.env.ELEVENLABS_HEIRLOOM_VOICE_ID || null;

function agentBody(input: { name?: string; prompt: string; firstMessage: string; voiceId: string }, multiVoice: boolean) {
  const def = heirloomVoiceId();
  return {
    ...(input.name ? { name: input.name } : {}),
    conversation_config: {
      agent: { prompt: { prompt: input.prompt }, first_message: input.firstMessage, language: "en" },
      tts: {
        voice_id: input.voiceId,
        ...(multiVoice && def ? { supported_voices: [{ label: HEIRLOOM_VOICE_TAG, voice_id: def, description: "Heirloom's own voice for disclosures, safety and refusals" }] } : {}),
      },
    },
    platform_settings: { auth: { enable_auth: true } },
  };
}

export async function createLegacyAgent(input: { name: string; prompt: string; firstMessage: string; voiceId: string }): Promise<{ agentId: string; multiVoice: boolean }> {
  const attempt = async (multi: boolean) => {
    const res = await call("/v1/convai/agents/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(agentBody(input, multi)) });
    const data = (await res.json()) as { agent_id?: string };
    if (!data.agent_id) throw new ElevenLabsError(502, "ElevenLabs returned no agent.");
    return data.agent_id;
  };
  const multi = Boolean(heirloomVoiceId());
  try { return { agentId: await attempt(multi), multiVoice: multi }; }
  catch (e) {
    // Multi-voice may not be available on every plan: retry with the parent's voice only.
    if (multi && e instanceof ElevenLabsError && e.status === 422) return { agentId: await attempt(false), multiVoice: false };
    throw e;
  }
}

export async function updateLegacyAgent(agentId: string, input: { prompt: string; firstMessage: string; voiceId: string }): Promise<void> {
  try {
    await call(`/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(agentBody(input, true)) });
  } catch (e) {
    if (e instanceof ElevenLabsError && e.status === 422) {
      await call(`/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(agentBody(input, false)) });
      return;
    }
    throw e;
  }
}

export async function deleteLegacyAgent(agentId: string): Promise<void> {
  try { await call(`/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" }); }
  catch (e) { if (!(e instanceof ElevenLabsError && e.status === 404)) throw e; }
}

export async function agentSignedUrl(agentId: string): Promise<string> {
  const res = await call(`/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, { timeoutMs: 8000 });
  const data = (await res.json()) as { signed_url?: string };
  if (!data.signed_url) throw new ElevenLabsError(502, "ElevenLabs returned no session.");
  return data.signed_url;
}
