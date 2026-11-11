/**
 * Legacy Voice: the parent's Legacy Book and the consent record for their cloned voice.
 * Client-safe (no server imports): used by the routes, the mock service and the UI editor.
 *
 * Safeguards encoded here (see README "Legacy Voice"):
 *  - consent is given by the living owner only, as a recorded line + an unticked box (validateVoiceInput)
 *  - the book is the ONLY source the companion may speak from (buildLegacyPrompt in ./prompt.ts)
 *  - voice_id never appears in any type the browser receives (LegacyVoiceInfo has no id)
 */
import { z } from "zod";

export const MILESTONE_KINDS = ["firstFees", "graduation", "firstJob", "birthday", "hardDay", "other"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

const line = (max: number) => z.string().trim().max(max);
const text = (max: number) => z.string().trim().max(max).default("");

export const guidanceSchema = z.object({
  study: text(800),
  money: text(800),
  faith: text(800),
  family: text(800),
  other: text(800),
});
export type Guidance = z.infer<typeof guidanceSchema>;
export const GUIDANCE_TOPICS = ["study", "money", "faith", "family", "other"] as const satisfies readonly (keyof Guidance)[];

export const legacyChildSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  name: line(40).min(1),
  /** Wallet of the beneficiary, when known, so the server can match the signed-in child. */
  wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,48}$/).optional(),
  guidance: guidanceSchema,
  note: text(800),
});
export type LegacyChild = z.infer<typeof legacyChildSchema>;

export const milestoneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  /** A child id from children[], or "all". */
  childId: z.string().regex(/^[a-z0-9-]{1,32}$/),
  kind: z.enum(MILESTONE_KINDS),
  title: line(80).min(1),
  text: line(1200).min(1),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const legacyBookSchema = z.object({
  version: z.literal(1).default(1),
  ownerName: line(80).min(1),
  /** What the children call them: "Dad", "Mama", "Papa", "Tata"… */
  calledBy: line(20).min(1).default("Dad"),
  pronoun: z.enum(["he", "she", "they"]).default("he"),
  values: z.array(line(300).min(1)).max(12).default([]),
  lessons: z.array(line(400).min(1)).max(12).default([]),
  phrases: z.array(line(200).min(1)).max(12).default([]),
  guidance: guidanceSchema,
  children: z.array(legacyChildSchema).max(8).default([]),
  milestones: z.array(milestoneSchema).max(40).default([]),
}).superRefine((b, ctx) => {
  const kids = new Set(b.children.map((c) => c.id));
  if (kids.size !== b.children.length) ctx.addIssue({ code: "custom", path: ["children"], message: "Child ids must be unique" });
  const ms = new Set<string>();
  b.milestones.forEach((m, i) => {
    if (ms.has(m.id)) ctx.addIssue({ code: "custom", path: ["milestones", i, "id"], message: "Milestone ids must be unique" });
    ms.add(m.id);
    if (m.childId !== "all" && !kids.has(m.childId)) ctx.addIssue({ code: "custom", path: ["milestones", i, "childId"], message: "Unknown child" });
  });
});
export type LegacyBook = z.infer<typeof legacyBookSchema>;

/** Public info about the voice. Deliberately has NO voice id: that stays on the server. */
export interface LegacyVoiceInfo {
  ownerName: string;
  /** Epoch ms when the owner recorded consent. */
  consentedAt: number;
  samples: number;
  /** True when no real ElevenLabs voice exists (browser speech stands in). */
  simulated: boolean;
  /** ElevenLabs may ask the account holder to verify a new voice before it can be used. */
  needsVerification?: boolean;
  /** Whether a live call (ElevenLabs agent) is available for this voice. */
  liveCall: boolean;
}

export interface LegacyStatus {
  voice: LegacyVoiceInfo | null;
  book: LegacyBook | null;
  /** For a child: whether they switched the legacy voice on. Owner: always true. */
  optedIn: boolean;
  /** Who is asking, as the server/mock resolved it. */
  viewer: "owner" | "child" | "other";
  /** The child entry in the book that matches the viewer, if any. */
  childId: string | null;
  /** Children may only talk after the estate unlocks. */
  unlocked: boolean;
}

export interface LegacySpeech {
  text: string;
  /** Object URL of rendered audio (ElevenLabs). Null when simulated: the UI uses speech synthesis. */
  audioUrl: string | null;
  simulated: boolean;
  /** "heirloom" = the default assistant voice (disclosures, safety, refusals), never the parent's. */
  voice: "parent" | "heirloom";
}

export interface LegacyChatReply {
  reply: string;
  voice: "parent" | "heirloom";
  /** "book" = drawn from the Legacy Book without an AI model; "ai" = model answer grounded in the book. */
  source: "book" | "ai" | "safety" | "refusal";
  /** Set when the child seemed distressed: the UI shows the helplines and stays out of character. */
  safety?: boolean;
  /** Opaque server token that lets /api/legacy/speak voice exactly this reply (no arbitrary text). */
  speakToken?: string;
}

/* ---------- consent ---------- */

export const CONSENT_LINE = "I, {name}, agree that Heirloom may create a copy of my voice to speak to my family after I'm gone.";
export const consentLine = (name: string) => CONSENT_LINE.replace("{name}", name.trim());

export const MIN_SAMPLES = 3;
export const MAX_SAMPLES = 8;
export const MIN_SAMPLE_BYTES = 4 * 1024;
export const MAX_SAMPLE_BYTES = 3 * 1024 * 1024;
/** Vercel functions accept ~4.5 MB per request; we stay under it. */
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const AUDIO_MIME = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/wav", "audio/mp4"] as const;
export type AudioMime = (typeof AUDIO_MIME)[number];

export interface VoiceInput {
  ownerName: string;
  consentAccepted: boolean;
  consentText: string;
  consentAudio: { size: number; type: string } | null;
  samples: { size: number; type: string }[];
}

/** Strips codec params: "audio/webm;codecs=opus" → "audio/webm". */
export const baseMime = (t: string) => t.split(";")[0].trim().toLowerCase();

/** Same checks on device (mock + UI) and on the server. Returns a list of problems; empty = OK. */
export function validateVoiceInput(v: VoiceInput): string[] {
  const out: string[] = [];
  if (!v.ownerName.trim()) out.push("Your name is needed for the consent line.");
  if (!v.consentAccepted) out.push("Tick the consent box to continue.");
  if (v.consentText.trim() !== consentLine(v.ownerName)) out.push("The consent line must be the exact sentence shown.");
  if (!v.consentAudio) out.push("Record yourself reading the consent line first.");
  const files = [...(v.consentAudio ? [v.consentAudio] : []), ...v.samples];
  if (v.samples.length < MIN_SAMPLES) out.push(`Record at least ${MIN_SAMPLES} short samples.`);
  if (v.samples.length > MAX_SAMPLES) out.push(`At most ${MAX_SAMPLES} samples.`);
  for (const f of files) {
    if (!(AUDIO_MIME as readonly string[]).includes(baseMime(f.type))) { out.push("Recordings must be WebM, Ogg, MP3, WAV or MP4 audio."); break; }
  }
  for (const f of files) {
    if (f.size < MIN_SAMPLE_BYTES) { out.push("One recording is too short. Speak for at least a few seconds."); break; }
    if (f.size > MAX_SAMPLE_BYTES) { out.push("One recording is too long. Keep each under a minute."); break; }
  }
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) out.push("The recordings are too large together. Keep the total to about two minutes.");
  return out;
}

/** Magic-byte sniffing so a renamed file is rejected. */
export function sniffAudio(b: Uint8Array): AudioMime | null {
  const s = (i: number, str: string) => [...str].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (s(0, "OggS")) return "audio/ogg";
  if (s(0, "RIFF") && s(8, "WAVE")) return "audio/wav";
  if (s(4, "ftyp")) return "audio/mp4";
  if (s(0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

/** Milestones that apply to one child (their own + "all"). */
export function milestonesFor(book: LegacyBook, childId: string | null): Milestone[] {
  return book.milestones.filter((m) => m.childId === "all" || m.childId === childId);
}

/** Finds the book's child entry for a wallet / display label. */
export function matchChild(book: LegacyBook, wallet: string | null | undefined, label?: string | null): LegacyChild | null {
  if (wallet) { const w = book.children.find((c) => c.wallet === wallet); if (w) return w; }
  const first = label?.split(/[ (]/)[0]?.toLowerCase();
  return first ? book.children.find((c) => c.name.split(" ")[0].toLowerCase() === first) ?? null : null;
}
