/**
 * Seed-at-rest encryption on the device: PBKDF2-SHA256 (310k iterations) → AES-256-GCM, WebCrypto only.
 * The seed phrase never leaves the browser and is never logged.
 */
export interface EncryptedSeed { v: 1; salt: string; iv: string; ct: string; iter: number }

const ITERATIONS = 310_000;
const te = new TextEncoder();
const td = new TextDecoder();

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", te.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export function assertPin(pin: string): void {
  if (!/^\d{6,}$/.test(pin)) throw new Error("PIN must be at least 6 digits.");
}

export async function encryptSeed(seedPhrase: string, pin: string): Promise<EncryptedSeed> {
  assertPin(pin);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt, ITERATIONS);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, te.encode(seedPhrase)));
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct), iter: ITERATIONS };
}

export async function decryptSeed(enc: EncryptedSeed, pin: string): Promise<string> {
  const key = await deriveKey(pin, unb64(enc.salt), enc.iter);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(enc.iv) as BufferSource }, key, unb64(enc.ct) as BufferSource);
    return td.decode(pt);
  } catch {
    throw new Error("Wrong PIN.");
  }
}
