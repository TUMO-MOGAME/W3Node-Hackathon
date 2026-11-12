import "server-only";
/**
 * Google Gemini client (@google/genai). Default model: gemini-4-argon (stable as of Oct 2026; text, image
 * and PDF input, structured outputs, function calling, Search grounding, thinking levels) — the fast
 * "efficient frontier" Gemini 4 model, which keeps voice/chat latency low. Override with GEMINI_MODEL.
 *
 * Every call: per-attempt timeout, one retry on transient errors, typed failure (AgentError) for the UI.
 */
import { GoogleGenAI, ThinkingLevel, type Content, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";
import { z } from "zod";

export const DEFAULT_GEMINI_MODEL = "gemini-4-argon";
export const geminiModel = () => process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

let ai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AgentError("not_configured", "GEMINI_API_KEY is not set.");
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
}

export class AgentError extends Error {
  constructor(public code: "not_configured" | "timeout" | "upstream" | "bad_output", message: string) {
    super(message);
    this.name = "AgentError";
  }
}

export interface CallOptions {
  system: string;
  contents: Content[];
  config?: Omit<GenerateContentConfig, "systemInstruction" | "abortSignal">;
  timeoutMs?: number;
  thinking?: "low" | "medium" | "high";
}

const LEVEL = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH };

function transient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE|timeout|aborted|fetch failed|ECONNRESET/i.test(msg);
}

export async function generate(opts: CallOptions): Promise<GenerateContentResponse> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await client().models.generateContent({
        model: geminiModel(),
        contents: opts.contents,
        config: {
          ...opts.config,
          systemInstruction: opts.system,
          abortSignal: AbortSignal.timeout(timeoutMs),
          thinkingConfig: { thinkingLevel: LEVEL[opts.thinking ?? "low"], ...opts.config?.thinkingConfig },
        },
      });
    } catch (e) {
      lastErr = e;
      if (e instanceof AgentError) throw e;
      if (attempt === 0 && transient(e)) { await new Promise((r) => setTimeout(r, 600)); continue; }
      break;
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (/timeout|aborted/i.test(msg)) throw new AgentError("timeout", "The AI agent took too long to answer. Please try again.");
  throw new AgentError("upstream", `The AI agent is unavailable right now (${msg.slice(0, 160)}).`);
}

// Keywords Gemini rejects with 400 INVALID_ARGUMENT in responseJsonSchema (seen on gemini-4-argon, Nov 2026).
// They are dropped from what we send; zod still enforces them on every reply in generateJson.
const UNSUPPORTED_KEYWORDS = new Set(["maxItems"]);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).filter(([k]) => !UNSUPPORTED_KEYWORDS.has(k)).map(([k, v]) => [k, stripUnsupported(v)]));
  }
  return node;
}

/** JSON Schema for Gemini's responseJsonSchema from a zod schema. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete s.$schema;
  return stripUnsupported(s) as Record<string, unknown>;
}

/** Structured output call validated with zod. Retries once with the validation error if the shape is off. */
export async function generateJson<T>(schema: z.ZodType<T>, opts: CallOptions): Promise<T> {
  const config = { ...opts.config, responseMimeType: "application/json", responseJsonSchema: jsonSchemaOf(schema) };
  let contents = opts.contents;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await generate({ ...opts, contents, config });
    const text = res.text ?? "";
    const parsed = safeParseJson(text);
    const out = schema.safeParse(parsed);
    if (out.success) return out.data;
    contents = [...contents, { role: "model", parts: [{ text }] },
      { role: "user", parts: [{ text: `That JSON did not match the schema: ${out.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Reply again with valid JSON only.` }] }];
  }
  throw new AgentError("bad_output", "The AI agent returned an unexpected answer. Please try again.");
}

export function safeParseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch { return null; }
}
