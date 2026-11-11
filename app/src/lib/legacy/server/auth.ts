import "server-only";
/**
 * Authorises /api/legacy/* requests. Stronger than /api/estate-meta (which trusts the claimed owner wallet):
 *  1. the request carries a WDK ed25519 signature over (action, estate, wallet, time, body hash), max 5 min old,
 *     single use (replays within the window are refused on this instance);
 *  2. the estate is read from Solana: the wallet must be its owner, or an active beneficiary.
 * Demo deployments without the chain (NEXT_PUBLIC_DATA_MODE=mock) are refused unless LEGACY_DEMO_WRITES=1,
 * in which case the role is taken from the demo persona (documented as demo-only; never enable in production).
 */
import { createPublicKey, verify } from "node:crypto";
import bs58 from "bs58";
import { z } from "zod";
import { HttpError, isChainMode } from "@/lib/api/http";
import { loadSnapshot } from "@/lib/server/estate";
import type { EstateSnapshot } from "@/lib/service/types";
import { AUTH_HEADER, AUTH_MAX_SKEW_MS, authMessage, type LegacyAction } from "../auth-message";

const addr = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const authSchema = z.object({
  estate: addr,
  wallet: addr,
  ts: z.number().int().positive(),
  sig: z.union([z.string().regex(/^[0-9a-f]{128}$/), z.literal("demo")]),
  demoRole: z.enum(["owner", "child"]).optional(),
  demoLabel: z.string().max(80).optional(),
});

export interface Viewer {
  role: "owner" | "child";
  wallet: string;
  estate: string;
  /** Beneficiary label ("Lerato (daughter)") or the owner's name. */
  label: string | null;
  /** Chain snapshot (null in demo mode). */
  snap: EstateSnapshot | null;
  demo: boolean;
}

const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");

export function verifyEd25519(wallet: string, message: string, sigHex: string): boolean {
  try {
    const raw = bs58.decode(wallet);
    if (raw.length !== 32) return false;
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(raw)]), format: "der", type: "spki" });
    return verify(null, Buffer.from(message, "utf8"), key, Buffer.from(sigHex, "hex"));
  } catch {
    return false;
  }
}

const seen = new Map<string, number>();
function once(sig: string, now: number) {
  for (const [k, t] of seen) if (now - t > AUTH_MAX_SKEW_MS * 2) seen.delete(k);
  if (seen.has(sig)) throw new HttpError(401, "This request was already used. Please try again.", "replay");
  seen.set(sig, now);
}

export const demoWritesAllowed = () => !isChainMode() && process.env.LEGACY_DEMO_WRITES === "1";

export function parseAuthHeader(req: Request): z.infer<typeof authSchema> {
  const raw = req.headers.get(AUTH_HEADER);
  if (!raw) throw new HttpError(401, "Sign in with your wallet first.", "unauthorized");
  let obj: unknown;
  try { obj = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); } catch { throw new HttpError(401, "Bad authorisation header.", "unauthorized"); }
  const p = authSchema.safeParse(obj);
  if (!p.success) throw new HttpError(401, "Bad authorisation header.", "unauthorized");
  return p.data;
}

export async function authorize(
  req: Request, action: LegacyAction, bodyHash: string, roles: Viewer["role"][] = ["owner", "child"], now = Date.now(),
): Promise<Viewer> {
  const a = parseAuthHeader(req);
  if (!isChainMode()) {
    if (!demoWritesAllowed()) throw new HttpError(503, "Legacy voice needs the live network.", "unavailable");
    const role = a.demoRole ?? "child";
    if (!roles.includes(role)) throw new HttpError(403, role === "child" ? "Only the parent can do this." : "Only family members can do this.", "forbidden");
    return { role, wallet: a.wallet, estate: a.estate, label: a.demoLabel ?? null, snap: null, demo: true };
  }
  if (a.sig === "demo") throw new HttpError(401, "A wallet signature is required.", "unauthorized");
  if (Math.abs(now - a.ts) > AUTH_MAX_SKEW_MS) throw new HttpError(401, "This request has expired. Check your phone's clock and try again.", "expired");
  if (!verifyEd25519(a.wallet, authMessage(action, a.estate, a.wallet, a.ts, bodyHash), a.sig)) throw new HttpError(401, "The wallet signature does not match.", "unauthorized");
  once(a.sig, now);

  const snap = await loadSnapshot(a.estate).catch(() => null);
  if (!snap) throw new HttpError(404, "Estate not found on-chain.", "not_found");
  const ben = snap.beneficiaries.find((b) => b.wallet === a.wallet && b.active);
  const role: Viewer["role"] | null = snap.estate.owner === a.wallet ? "owner" : ben ? "child" : null;
  if (!role || !roles.includes(role)) throw new HttpError(403, roles.length === 1 && roles[0] === "owner" ? "Only the estate owner can do this." : "Only the estate's family can do this.", "forbidden");
  return { role, wallet: a.wallet, estate: a.estate, label: role === "owner" ? snap.estate.ownerName : ben!.label, snap, demo: false };
}
