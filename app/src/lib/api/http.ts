import "server-only";
/**
 * Shared helpers for route handlers: JSON responses with bigint support, typed errors → status codes,
 * zod body parsing, client IP, and a simple per-IP fixed-window rate limit (in-memory; per instance).
 */
import { z } from "zod";
import { AgentError } from "../agent/gemini";
import { UploadError } from "../storage";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return new Response(body, { ...init, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers } });
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "error") { super(message); }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code }, { status: e.status });
  if (e instanceof z.ZodError) return json({ error: "Invalid request", code: "invalid", issues: e.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  if (e instanceof UploadError) return json({ error: e.message, code: "upload" }, { status: 400 });
  if (e instanceof AgentError) return json({ error: e.message, code: e.code }, { status: e.code === "timeout" ? 504 : e.code === "not_configured" ? 503 : 502 });
  const msg = e instanceof Error ? e.message : "Unexpected error";
  console.error("[api]", msg);
  return json({ error: msg.slice(0, 300), code: "server" }, { status: 500 });
}

export async function parseJson<T>(req: Request, schema: z.ZodType<T>, maxBytes = 200_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "Request too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new HttpError(400, "Body must be JSON"); }
  return schema.parse(raw);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

const windows = new Map<string, { start: number; count: number }>();

/** Fixed window: `limit` requests per `windowMs` per IP per bucket. Throws 429 when exceeded. */
export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 60_000, now = Date.now()): void {
  const key = `${bucket}:${clientIp(req)}`;
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    return;
  }
  w.count++;
  if (w.count > limit) throw new HttpError(429, "Too many requests. Please wait a minute and try again.", "rate_limited");
}

/** Wraps a handler with uniform error handling. */
export function handler(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try { return await fn(req); } catch (e) { return errorResponse(e); }
  };
}

export const isChainMode = () => process.env.NEXT_PUBLIC_DATA_MODE === "chain";
