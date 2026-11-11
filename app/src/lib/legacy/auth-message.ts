/**
 * Request signing for the /api/legacy/* routes. The browser's Tether WDK wallet signs (ed25519, hex) a short
 * message binding the action, estate, wallet, time and a SHA-256 of the request body; the server verifies it
 * and then checks on-chain whether that wallet is the estate's owner or a beneficiary.
 * The header value is base64(JSON(LegacyAuth)).
 */
export const AUTH_HEADER = "x-heirloom-auth";
export const AUTH_MAX_SKEW_MS = 5 * 60 * 1000;

export type LegacyAction = "status" | "voice.create" | "voice.delete" | "book.read" | "book.write" | "book.delete" | "optin" | "speak" | "chat" | "session";

export interface LegacyAuth {
  estate: string;
  wallet: string;
  ts: number;
  /** ed25519 signature (hex) of authMessage(); "demo" only when the server allows demo writes. */
  sig: string;
  /** Demo deployments only (LEGACY_DEMO_WRITES=1): who the mock persona is. Ignored in chain mode. */
  demoRole?: "owner" | "child";
  demoLabel?: string;
}

export function authMessage(action: LegacyAction, estate: string, wallet: string, ts: number, bodyHash: string): string {
  return `Heirloom legacy voice\naction:${action}\nestate:${estate}\nwallet:${wallet}\nts:${ts}\nbody:${bodyHash}`;
}

export function encodeAuth(a: LegacyAuth): string {
  const json = JSON.stringify(a);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
