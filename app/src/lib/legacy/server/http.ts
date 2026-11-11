import "server-only";
import type { z } from "zod";
import { HttpError } from "@/lib/api/http";
import { sha256Hex } from "@/lib/agent/hash";
import type { LegacyAction } from "../auth-message";
import { authorize, type Viewer } from "./auth";

/** Reads a JSON body once, returning it parsed plus the SHA-256 of the exact text (bound into the signature). */
export async function jsonBody<T>(req: Request, schema: z.ZodType<T>, maxBytes = 120_000): Promise<{ body: T; hash: string }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "Request too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new HttpError(400, "Body must be JSON"); }
  return { body: schema.parse(raw), hash: await sha256Hex(text) };
}

export async function authJson<T>(req: Request, action: LegacyAction, schema: z.ZodType<T>, roles?: Viewer["role"][]): Promise<{ body: T; viewer: Viewer }> {
  const { body, hash } = await jsonBody(req, schema);
  return { body, viewer: await authorize(req, action, hash, roles) };
}

export async function authEmpty(req: Request, action: LegacyAction, roles?: Viewer["role"][]): Promise<Viewer> {
  return authorize(req, action, await sha256Hex(""), roles);
}
