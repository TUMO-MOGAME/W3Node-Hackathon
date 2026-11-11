import "server-only";
/**
 * The parent's voice must never say arbitrary text a client supplies (that would turn a cloned voice into a
 * fraud tool: "it's Dad, send R5,000 to…"). /api/legacy/chat returns a short-lived HMAC token bound to the
 * estate and the exact reply text; /api/legacy/speak voices text only with a valid token, a milestone id
 * (owner-written), or for the owner previewing their own voice.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 30 * 60 * 1000;
let fallback: Buffer | null = null;

function secret(): Buffer {
  const s = process.env.LEGACY_SPEAK_SECRET || process.env.ELEVENLABS_TOOL_SECRET;
  if (s) return createHash("sha256").update(`legacy-speak:${s}`).digest();
  fallback ??= randomBytes(32); // per instance: tokens then only work on the instance that issued them
  return fallback;
}

const mac = (estate: string, exp: number, text: string) =>
  createHmac("sha256", secret()).update(`${estate}\n${exp}\n${createHash("sha256").update(text).digest("hex")}`).digest("base64url");

export function issueSpeakToken(estate: string, text: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  return `${exp}.${mac(estate, exp, text)}`;
}

export function checkSpeakToken(estate: string, text: string, token: string, now = Date.now()): boolean {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now || !sig) return false;
  const want = Buffer.from(mac(estate, exp, text));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
