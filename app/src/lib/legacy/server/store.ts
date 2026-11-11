import "server-only";
/**
 * Legacy Voice storage (schema: supabase/migrations/0002_legacy.sql). Personal information under POPIA:
 * voice samples, the consent recording, rendered audio and the Legacy Book. Private bucket `legacy-audio` and
 * RLS-locked tables, accessed only with the service-role key on the server. In-memory fallback without Supabase.
 * The ElevenLabs voice_id and agent_id live here and are never returned to the browser.
 */
import { getSupabase } from "@/lib/supabase";
import { sha256Hex, hashJson } from "@/lib/agent/hash";
import type { LegacyBook } from "../schema";

export const LEGACY_BUCKET = "legacy-audio";

export interface VoiceRow {
  estate: string;
  ownerWallet: string;
  ownerName: string;
  voiceId: string | null;   // null = simulated (no ElevenLabs key)
  agentId: string | null;
  requiresVerification: boolean;
  consentText: string;
  consentSha256: string;
  consentPath: string;
  samplePaths: string[];
  sampleSha256: string[];
  consentedAt: number;      // epoch ms
}

export interface BookRow { estate: string; ownerWallet: string; book: LegacyBook; bookSha256: string; optIns: Record<string, boolean> }

const mem = {
  voices: new Map<string, VoiceRow>(),
  books: new Map<string, BookRow>(),
  audio: new Map<string, { bytes: Uint8Array; mime: string }>(),
  messages: new Map<string, string>(), // `${estate}:${textSha}` → audio path
};

function warn(what: string, err: { message: string } | null) { if (err) console.warn(`[legacy] ${what} failed: ${err.message}`); }
/** Paths never contain names: estate hash prefix + content hash. */
export async function estateKey(estate: string) { return (await sha256Hex(`legacy:${estate}`)).slice(0, 24); }

export async function putAudio(path: string, bytes: Uint8Array, mime: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) { mem.audio.set(path, { bytes, mime }); return; }
  const { error } = await sb.storage.from(LEGACY_BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Could not store the recording: ${error.message}`);
}

export async function getAudio(path: string): Promise<Uint8Array | null> {
  const sb = getSupabase();
  if (!sb) return mem.audio.get(path)?.bytes ?? null;
  const { data, error } = await sb.storage.from(LEGACY_BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

async function removeAudio(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const sb = getSupabase();
  if (!sb) { paths.forEach((p) => mem.audio.delete(p)); return; }
  const { error } = await sb.storage.from(LEGACY_BUCKET).remove(paths);
  warn("removeAudio", error);
}

/* ---------- voices ---------- */

export async function getVoice(estate: string): Promise<VoiceRow | null> {
  const sb = getSupabase();
  if (!sb) return mem.voices.get(estate) ?? null;
  const { data, error } = await sb.from("legacy_voices").select("*").eq("estate", estate).maybeSingle();
  warn("getVoice", error);
  if (!data) return null;
  return {
    estate: data.estate, ownerWallet: data.owner_wallet, ownerName: data.owner_name, voiceId: data.voice_id, agentId: data.agent_id,
    requiresVerification: data.requires_verification, consentText: data.consent_text, consentSha256: data.consent_sha256,
    consentPath: data.consent_path, samplePaths: data.sample_paths ?? [], sampleSha256: data.sample_sha256 ?? [],
    consentedAt: new Date(data.consented_at).getTime(),
  };
}

export async function saveVoice(v: VoiceRow): Promise<void> {
  const sb = getSupabase();
  if (!sb) { mem.voices.set(v.estate, v); return; }
  const { error } = await sb.from("legacy_voices").upsert({
    estate: v.estate, owner_wallet: v.ownerWallet, owner_name: v.ownerName, voice_id: v.voiceId, agent_id: v.agentId,
    requires_verification: v.requiresVerification, consent_text: v.consentText, consent_sha256: v.consentSha256,
    consent_path: v.consentPath, sample_paths: v.samplePaths, sample_sha256: v.sampleSha256, consented_at: new Date(v.consentedAt).toISOString(),
  });
  if (error) throw new Error(`Could not save the voice: ${error.message}`);
}

export async function setAgentId(estate: string, agentId: string | null): Promise<void> {
  const sb = getSupabase();
  if (!sb) { const v = mem.voices.get(estate); if (v) v.agentId = agentId; return; }
  const { error } = await sb.from("legacy_voices").update({ agent_id: agentId }).eq("estate", estate);
  warn("setAgentId", error);
}

/** Deletes the voice row, its recordings and every rendered message. The book is kept (deleted separately). */
export async function deleteVoice(estate: string): Promise<void> {
  const v = await getVoice(estate);
  const sb = getSupabase();
  const key = await estateKey(estate);
  if (!sb) {
    mem.voices.delete(estate);
    for (const k of [...mem.messages.keys()]) if (k.startsWith(`${estate}:`)) mem.messages.delete(k);
    for (const p of [...mem.audio.keys()]) if (p.includes(key)) mem.audio.delete(p);
    return;
  }
  const { data: msgs } = await sb.from("legacy_messages").select("audio_path").eq("estate", estate);
  await removeAudio([...(v ? [v.consentPath, ...v.samplePaths] : []), ...(msgs ?? []).map((m) => m.audio_path as string)]);
  warn("deleteMessages", (await sb.from("legacy_messages").delete().eq("estate", estate)).error);
  warn("deleteVoice", (await sb.from("legacy_voices").delete().eq("estate", estate)).error);
}

/* ---------- books ---------- */

export async function getBook(estate: string): Promise<BookRow | null> {
  const sb = getSupabase();
  if (!sb) return mem.books.get(estate) ?? null;
  const { data, error } = await sb.from("legacy_books").select("*").eq("estate", estate).maybeSingle();
  warn("getBook", error);
  if (!data) return null;
  return { estate: data.estate, ownerWallet: data.owner_wallet, book: data.book as LegacyBook, bookSha256: data.book_sha256, optIns: data.opt_ins ?? {} };
}

export async function saveBook(estate: string, ownerWallet: string, book: LegacyBook): Promise<BookRow> {
  const prev = await getBook(estate);
  const row: BookRow = { estate, ownerWallet, book, bookSha256: await hashJson(book), optIns: prev?.optIns ?? {} };
  const sb = getSupabase();
  if (!sb) { mem.books.set(estate, row); return row; }
  const { error } = await sb.from("legacy_books").upsert({
    estate, owner_wallet: ownerWallet, book, book_sha256: row.bookSha256, opt_ins: row.optIns, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save the Legacy Book: ${error.message}`);
  return row;
}

export async function deleteBook(estate: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) { mem.books.delete(estate); return; }
  warn("deleteBook", (await sb.from("legacy_books").delete().eq("estate", estate)).error);
}

export async function setOptIn(estate: string, wallet: string, on: boolean): Promise<void> {
  const row = await getBook(estate);
  if (!row) return;
  const optIns = { ...row.optIns, [wallet]: on };
  const sb = getSupabase();
  if (!sb) { mem.books.set(estate, { ...row, optIns }); return; }
  warn("setOptIn", (await sb.from("legacy_books").update({ opt_ins: optIns }).eq("estate", estate)).error);
}

/* ---------- rendered messages (TTS cache) ---------- */

export async function cachedMessage(estate: string, textSha: string): Promise<Uint8Array | null> {
  const sb = getSupabase();
  let path: string | undefined;
  if (!sb) path = mem.messages.get(`${estate}:${textSha}`);
  else {
    const { data } = await sb.from("legacy_messages").select("audio_path").eq("estate", estate).eq("text_sha256", textSha).maybeSingle();
    path = data?.audio_path as string | undefined;
  }
  return path ? getAudio(path) : null;
}

export async function cacheMessage(estate: string, textSha: string, milestoneId: string | null, bytes: Uint8Array): Promise<void> {
  const path = `messages/${await estateKey(estate)}/${textSha}.mp3`;
  await putAudio(path, bytes, "audio/mpeg");
  const sb = getSupabase();
  if (!sb) { mem.messages.set(`${estate}:${textSha}`, path); return; }
  warn("cacheMessage", (await sb.from("legacy_messages").upsert({ estate, text_sha256: textSha, milestone_id: milestoneId, audio_path: path }, { onConflict: "estate,text_sha256" })).error);
}
