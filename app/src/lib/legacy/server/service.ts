import "server-only";
/**
 * Legacy Voice server logic shared by /api/legacy/* and /api/voice/session (legacy mode).
 * Every function takes a Viewer from ./auth.ts (signature + on-chain role already checked).
 */
import { HttpError } from "@/lib/api/http";
import { sha256Hex } from "@/lib/agent/hash";
import { orchestrate } from "@/lib/agent/orchestrator";
import { formatUsdt } from "@/lib/format";
import type { EstateSnapshot } from "@/lib/service/types";
import type { WillChatMessage } from "@/lib/types";
import { buildLegacyPrompt, detectMoneyRequest, disclosureLine } from "../prompt";
import {
  baseMime, consentLine, matchChild, sniffAudio, validateVoiceInput,
  type LegacyBook, type LegacyChatReply, type LegacyChild, type LegacyStatus, type LegacyVoiceInfo,
} from "../schema";
import type { Viewer } from "./auth";
import * as el from "./elevenlabs";
import * as store from "./store";
import { checkSpeakToken, issueSpeakToken } from "./speak-token";

const isUnlocked = (v: Viewer) => (v.snap ? v.snap.estate.status === "Unlocked" : v.demo);

function voiceInfo(row: store.VoiceRow): LegacyVoiceInfo {
  return {
    ownerName: row.ownerName, consentedAt: row.consentedAt, samples: row.samplePaths.length, simulated: !row.voiceId,
    needsVerification: row.requiresVerification || undefined, liveCall: Boolean(row.voiceId && process.env.ELEVENLABS_API_KEY),
  };
}

/** Before unlock a child sees only how the parent is named, not the book's contents. */
function redact(b: LegacyBook): LegacyBook {
  return { ...b, values: [], lessons: [], phrases: [], guidance: { study: "", money: "", faith: "", family: "", other: "" }, children: [], milestones: [] };
}

function childFor(v: Viewer, book: LegacyBook): LegacyChild | null {
  return v.role === "child" ? matchChild(book, v.wallet, v.label) : null;
}

export async function status(v: Viewer): Promise<LegacyStatus> {
  const [voice, row] = await Promise.all([store.getVoice(v.estate), store.getBook(v.estate)]);
  const unlocked = isUnlocked(v);
  const optedIn = v.role === "owner" ? true : Boolean(row?.optIns[v.wallet]);
  const book = row ? (v.role === "owner" || (unlocked && optedIn) ? row.book : redact(row.book)) : null;
  return {
    voice: voice ? voiceInfo(voice) : null, book, optedIn, viewer: v.role,
    childId: row ? childFor(v, row.book)?.id ?? null : null, unlocked,
  };
}

/* ---------- voice ---------- */

export interface VoiceUpload { ownerName: string; consentAccepted: boolean; consentText: string; consent: File | null; samples: File[] }

/** Canonical body hash the browser signs for a multipart upload. */
export async function uploadHash(u: { ownerName: string; consentText: string; consentSha: string; sampleShas: string[] }) {
  return sha256Hex(JSON.stringify({ ownerName: u.ownerName, consentText: u.consentText, consent: u.consentSha, samples: u.sampleShas }));
}

export async function readUpload(u: VoiceUpload) {
  const problems = validateVoiceInput({
    ownerName: u.ownerName, consentAccepted: u.consentAccepted, consentText: u.consentText,
    consentAudio: u.consent ? { size: u.consent.size, type: u.consent.type } : null,
    samples: u.samples.map((f) => ({ size: f.size, type: f.type })),
  });
  if (problems.length) throw new HttpError(400, problems[0], "invalid");
  const read = async (f: File) => {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const sniffed = sniffAudio(bytes);
    if (!sniffed || (sniffed !== baseMime(f.type) && !(sniffed === "audio/webm" && baseMime(f.type) === "audio/ogg"))) {
      throw new HttpError(400, "A recording's contents do not match its type.", "invalid");
    }
    return { bytes, mime: sniffed, sha: await sha256Hex(bytes) };
  };
  return { consent: await read(u.consent!), samples: await Promise.all(u.samples.map(read)) };
}

export async function createVoice(v: Viewer, u: VoiceUpload, files: Awaited<ReturnType<typeof readUpload>>): Promise<LegacyVoiceInfo> {
  if (v.role !== "owner") throw new HttpError(403, "Only the estate owner can create their voice.", "forbidden");
  // Rule 1: only a living owner. Once a passing is reported, no voice can be created or replaced.
  if (v.snap && v.snap.estate.status !== "Active") throw new HttpError(409, "A legacy voice can only be created by the owner while the estate is active.", "bad_status");
  if (u.consentText !== consentLine(u.ownerName)) throw new HttpError(400, "The consent line must be the exact sentence shown.", "invalid");

  const existing = await store.getVoice(v.estate);
  if (existing) await removeVoice(v);

  const key = await store.estateKey(v.estate);
  const ext = (m: string) => m.split("/")[1].replace("mpeg", "mp3");
  const consentPath = `consent/${key}/${files.consent.sha}.${ext(files.consent.mime)}`;
  await store.putAudio(consentPath, files.consent.bytes, files.consent.mime);
  const samplePaths: string[] = [];
  for (const s of files.samples) {
    const p = `samples/${key}/${s.sha}.${ext(s.mime)}`;
    await store.putAudio(p, s.bytes, s.mime);
    samplePaths.push(p);
  }

  const consentedAt = Date.now();
  let voiceId: string | null = null;
  let requiresVerification = false;
  let agentId: string | null = null;
  if (el.hasElevenLabs()) {
    const r = await el.createInstantVoice({
      name: `Heirloom legacy ${key.slice(0, 8)}`,
      description: `Instant voice clone created by the estate owner with recorded consent on ${new Date(consentedAt).toISOString().slice(0, 10)} (Heirloom Legacy Voice).`,
      files: files.samples.map((s, i) => ({ bytes: s.bytes, mime: s.mime, name: `sample-${i + 1}.${ext(s.mime)}` })),
    });
    voiceId = r.voiceId;
    requiresVerification = r.requiresVerification;
  }
  const row: store.VoiceRow = {
    estate: v.estate, ownerWallet: v.wallet, ownerName: u.ownerName.trim(), voiceId, agentId, requiresVerification,
    consentText: u.consentText, consentSha256: files.consent.sha, consentPath, samplePaths, sampleSha256: files.samples.map((s) => s.sha), consentedAt,
  };
  await store.saveVoice(row);
  if (voiceId) {
    // Best effort: the live-call agent can also be created lazily at the first call.
    agentId = await ensureAgent(row).catch((e) => { console.warn("[legacy] agent create failed:", e instanceof Error ? e.message : e); return null; });
  }
  return voiceInfo({ ...row, agentId });
}

/** Deletes the voice everywhere: ElevenLabs agent + voice, recordings, rendered messages. */
export async function removeVoice(v: Viewer): Promise<void> {
  if (v.role !== "owner") throw new HttpError(403, "Only the estate owner can delete their voice.", "forbidden");
  const row = await store.getVoice(v.estate);
  if (!row) return;
  if (row.agentId) await el.deleteLegacyAgent(row.agentId);
  if (row.voiceId) await el.deleteElevenVoice(row.voiceId);
  await store.deleteVoice(v.estate);
}

/* ---------- book ---------- */

export async function putBook(v: Viewer, book: LegacyBook): Promise<LegacyBook> {
  if (v.role !== "owner") throw new HttpError(403, "Only the estate owner can write the Legacy Book.", "forbidden");
  if (v.snap && v.snap.estate.status !== "Active") throw new HttpError(409, "The Legacy Book is sealed once a passing is reported.", "bad_status");
  // Keep child wallets in step with the on-chain beneficiaries where the names match.
  const kids = v.snap?.beneficiaries ?? [];
  const linked = {
    ...book,
    children: book.children.map((c) => c.wallet ? c : { ...c, wallet: kids.find((b) => b.label.split(/[ (]/)[0].toLowerCase() === c.name.split(" ")[0].toLowerCase())?.wallet }),
  };
  await store.saveBook(v.estate, v.wallet, linked);
  return linked;
}

export async function removeBook(v: Viewer): Promise<void> {
  if (v.role !== "owner") throw new HttpError(403, "Only the estate owner can delete the Legacy Book.", "forbidden");
  await store.deleteBook(v.estate);
}

export async function optIn(v: Viewer, on: boolean): Promise<void> {
  if (v.role !== "child") throw new HttpError(403, "Only a child of the estate can switch the legacy voice on or off.", "forbidden");
  if (!(await store.getBook(v.estate))) throw new HttpError(404, "There is no Legacy Book for this estate.", "not_found");
  await store.setOptIn(v.estate, v.wallet, on);
}

/* ---------- talking ---------- */

async function talkContext(v: Viewer, previewChildId?: string) {
  const row = await store.getBook(v.estate);
  if (!row) throw new HttpError(404, "There is no Legacy Book for this estate.", "not_found");
  if (v.role === "child") {
    if (!isUnlocked(v)) throw new HttpError(403, "The legacy voice opens once the estate unlocks.", "locked");
    if (!row.optIns[v.wallet]) throw new HttpError(403, "Switch the legacy voice on first.", "not_opted_in");
  }
  const child = v.role === "child" ? childFor(v, row.book) : row.book.children.find((c) => c.id === previewChildId) ?? null;
  const voice = await store.getVoice(v.estate);
  return { book: row.book, child, voice };
}

export function estateFacts(snap: EstateSnapshot | null, childWallet: string | null): string[] {
  if (!snap) return [];
  const e = snap.estate;
  const out = [`The estate is ${e.status === "Unlocked" ? "unlocked: the rules are running" : e.status === "DeathPending" ? "waiting for the passing to be confirmed" : "active"}.`];
  const payee = (w: string) => snap.payees.find((p) => p.wallet === w)?.name ?? "an approved institution";
  for (const c of snap.claims.filter((x) => x.beneficiary === childWallet).slice(-5)) {
    out.push(`A ${formatUsdt(c.amount, { decimals: 0 })} claim to ${payee(c.payee)} is ${c.status === "Paid" ? "paid" : c.status === "Open" ? "waiting for approval" : "rejected"}.`);
  }
  // How far the child is under each rule the parent set for them (so the voice can speak to their progress).
  for (const r of snap.rules.filter((x) => x.beneficiary === childWallet)) {
    const used = `${formatUsdt(r.spentTotal, { decimals: 0 })} of ${formatUsdt(r.lifetimeCap, { decimals: 0 })}`;
    out.push(r.recurringAmount > BigInt(0) && r.fixedPayee
      ? `${r.category}: ${formatUsdt(r.recurringAmount, { decimals: 0 })} is paid automatically to ${payee(r.fixedPayee)} on schedule; ${used} paid so far.`
      : `${r.category}: ${used} used so far, paid straight to the institution; up to ${formatUsdt(r.maxPerClaim, { decimals: 0 })} per claim.`);
  }
  const car = snap.assets[0];
  if (car) out.push(`The family car is ${car.status === "Sold" ? "sold, and the money went into the estate's vault for the children" : car.status === "Listed" ? "for sale" : "kept"}.`);
  return out;
}

function promptFor(v: Viewer, ctx: Awaited<ReturnType<typeof talkContext>>, channel: "voice" | "text", multiVoice = false) {
  return buildLegacyPrompt({
    book: ctx.book, child: ctx.child, channel,
    estateStatus: v.snap?.estate.status ?? (v.demo ? "Unlocked (demo)" : "unknown"),
    estateFacts: estateFacts(v.snap, ctx.child?.wallet ?? (v.role === "child" ? v.wallet : null)),
    consentDate: ctx.voice ? new Date(ctx.voice.consentedAt).toISOString().slice(0, 10) : "unknown",
    heirloomVoiceTag: multiVoice ? el.HEIRLOOM_VOICE_TAG : undefined,
  });
}

export async function chat(v: Viewer, history: WillChatMessage[], previewChildId?: string): Promise<LegacyChatReply> {
  const ctx = await talkContext(v, previewChildId);
  const out = await orchestrate(
    { history, facts: null, context: { role: v.role === "child" ? "beneficiary" : "owner", channel: "text" }, legacy: { book: ctx.book, child: ctx.child, prompt: promptFor(v, ctx, "text") } },
    "LegacyCompanion",
  );
  const meta = out.legacy ?? { voice: "heirloom" as const, source: "refusal" as const };
  return {
    reply: out.reply, voice: meta.voice, source: meta.source, safety: meta.safety,
    speakToken: meta.voice === "parent" && ctx.voice ? issueSpeakToken(v.estate, out.reply) : undefined,
  };
}

const daily = new Map<string, { day: string; n: number }>();
/** Per-estate cap on rendered speech (cost + abuse). Per instance; Supabase cache makes repeats free. */
export const SPEAK_DAILY_LIMIT = 200;
function countSpeak(estate: string) {
  const day = new Date().toISOString().slice(0, 10);
  const d = daily.get(estate);
  if (!d || d.day !== day) { daily.set(estate, { day, n: 1 }); return; }
  if (++d.n > SPEAK_DAILY_LIMIT) throw new HttpError(429, "The legacy voice has spoken a lot today. Please try again tomorrow.", "rate_limited");
}

export type SpeakRequest = { milestoneId: string } | { text: string; token?: string };
export const OWNER_PREVIEW_MAX = 300;

/** Returns MP3 bytes in the parent's voice, or null when simulated (the browser speaks the text instead). */
export async function speak(v: Viewer, req: SpeakRequest): Promise<{ text: string; audio: Uint8Array | null }> {
  const ctx = await talkContext(v);
  let text: string;
  let milestoneId: string | null = null;
  if ("milestoneId" in req) {
    const m = ctx.book.milestones.find((x) => x.id === req.milestoneId && (v.role === "owner" || x.childId === "all" || x.childId === ctx.child?.id));
    if (!m) throw new HttpError(404, "That message was not found.", "not_found");
    text = m.text; milestoneId = m.id;
  } else if (req.token && checkSpeakToken(v.estate, req.text, req.token)) {
    text = req.text;
  } else if (v.role === "owner" && req.text.length <= OWNER_PREVIEW_MAX && !detectMoneyRequest(req.text)) {
    text = req.text; // the owner previewing their own voice
  } else {
    throw new HttpError(403, "The legacy voice only speaks words from the Legacy Book.", "forbidden");
  }
  if (!ctx.voice?.voiceId) return { text, audio: null };
  if (ctx.voice.requiresVerification) throw new HttpError(409, "This voice still needs verification in the ElevenLabs dashboard.", "needs_verification");
  const sha = await sha256Hex(`${ctx.voice.voiceId}\n${text}`);
  const hit = await store.cachedMessage(v.estate, sha);
  if (hit) return { text, audio: hit };
  countSpeak(v.estate);
  const audio = await el.textToSpeech(ctx.voice.voiceId, text);
  await store.cacheMessage(v.estate, sha, milestoneId, audio).catch((e) => console.warn("[legacy] cache failed:", e instanceof Error ? e.message : e));
  return { text, audio };
}

async function ensureAgent(row: store.VoiceRow, prompt?: string): Promise<string> {
  if (row.agentId) return row.agentId;
  const book = (await store.getBook(row.estate))?.book;
  const p = prompt ?? (book ? buildLegacyPrompt({ book, child: null, channel: "voice", estateStatus: "unknown", consentDate: new Date(row.consentedAt).toISOString().slice(0, 10) }) : "You are Heirloom. The Legacy Book is empty: say so kindly and end the call.");
  const { agentId } = await el.createLegacyAgent({
    name: `Heirloom legacy ${(await store.estateKey(row.estate)).slice(0, 8)}`, prompt: p, voiceId: row.voiceId!,
    firstMessage: book ? disclosureLine(book) : "This is Heirloom.",
  });
  await store.setAgentId(row.estate, agentId);
  return agentId;
}

/** Live call: refresh the private agent's prompt for THIS verified child + live status, then mint a signed URL. */
export async function session(v: Viewer, previewChildId?: string): Promise<{ signedUrl: string; label: { consentedAt: number } }> {
  const ctx = await talkContext(v, previewChildId);
  if (!ctx.voice?.voiceId || !el.hasElevenLabs()) throw new HttpError(503, "Live calls need ElevenLabs.", "unavailable");
  if (ctx.voice.requiresVerification) throw new HttpError(409, "This voice still needs verification in the ElevenLabs dashboard.", "needs_verification");
  const multi = Boolean(el.heirloomVoiceId());
  const prompt = promptFor(v, ctx, "voice", multi);
  const agentId = ctx.voice.agentId ?? await ensureAgent(ctx.voice, prompt);
  await el.updateLegacyAgent(agentId, { prompt, firstMessage: disclosureLine(ctx.book), voiceId: ctx.voice.voiceId });
  return { signedUrl: await el.agentSignedUrl(agentId), label: { consentedAt: ctx.voice.consentedAt } };
}
