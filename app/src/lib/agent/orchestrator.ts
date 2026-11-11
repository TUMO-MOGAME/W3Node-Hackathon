import "server-only";
/**
 * Orchestrator: Gemini function calling (forced `route_to`) picks one specialist, which then answers with its
 * own prompt and tools. If routing fails or Gemini is not configured, a keyword router decides instead.
 * Returns { specialist, reply, actions[] } for text chat, voice (ElevenLabs webhook) and the classic routes.
 */
import { FunctionCallingConfigMode } from "@google/genai";
import { z } from "zod";
import type { SpecialistName } from "../voice/types";
import { generate, hasGemini, jsonSchemaOf } from "./gemini";
import { ORCHESTRATOR } from "./prompts";
import { runSpecialist, type SpecialistInput, type SpecialistResult } from "./specialists";
import { toContents } from "./will";

/**
 * Specialists the router may pick. LegacyCompanion (the parent's voice) is deliberately NOT routable: it is reached
 * only through /api/legacy/chat (and the legacy voice agent), after the server verified the child, their opt-in and
 * that the estate is unlocked. See lib/agent/legacy-companion.ts.
 */
export const ROUTABLE = ["WillWriter", "DocumentReviewer", "ClaimsGuide", "CarBroker", "EstateGuide", "Compliance"] as const;
export type Routable = (typeof ROUTABLE)[number];

const routeArgs = z.object({ specialist: z.enum(ROUTABLE), reason: z.string().max(200) });

const KEYWORDS: [Routable, RegExp][] = [
  ["Compliance", /\b(popia|privacy|legal|lawyer|law|valid will|wills act|who (can )?see|safe|secure|data|regulat|fsca|sars)\b/i],
  ["DocumentReviewer", /\b(death certificate|certificate|upload|document|affidavit|fee statement|invoice|lease|scan|photo)\b/i],
  ["CarBroker", /\b(car|vehicle|corolla|offer|buyer|sell|sale|asking price|valu|floor price)\b/i],
  ["ClaimsGuide", /\b(claim|tuition|fees?|accommodation|residence|rent|books|medical|pay(ment)? (for|to)|how much can i)\b/i],
  ["WillWriter", /\b(will|beneficiar|verifier|executor|rule|inherit|my children|write|draft|waiting period)\b/i],
  ["EstateGuide", /\b(status|why|blocked|rejected|what happens|next|unlock|vault|balance|veto)\b/i],
];

export function keywordRoute(text: string, role?: string): Routable {
  for (const [name, re] of KEYWORDS) if (re.test(text)) return name;
  if (role === "owner") return "WillWriter";
  if (role === "beneficiary") return "ClaimsGuide";
  if (role === "buyer") return "CarBroker";
  return "EstateGuide";
}

export async function route(input: SpecialistInput): Promise<{ specialist: Routable; reason: string }> {
  const last = input.history[input.history.length - 1]?.text ?? "";
  if (!hasGemini()) return { specialist: keywordRoute(last, input.context.role), reason: "keyword routing (AI not configured)" };
  try {
    const res = await generate({
      system: `${ORCHESTRATOR}\nCaller role: ${input.context.role ?? "unknown"}; page: ${input.context.page ?? "unknown"}.`,
      contents: toContents(input.history.slice(-6)),
      thinking: "low",
      timeoutMs: 12_000,
      config: {
        tools: [{ functionDeclarations: [{ name: "route_to", description: "Send the conversation to one specialist.", parametersJsonSchema: jsonSchemaOf(routeArgs) }] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["route_to"] } },
      },
    });
    const call = res.functionCalls?.find((c) => c.name === "route_to");
    const parsed = routeArgs.safeParse(call?.args);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through to keywords: routing must never block the user
  }
  return { specialist: keywordRoute(last, input.context.role), reason: "keyword routing (fallback)" };
}

export interface OrchestrateResult extends SpecialistResult { routedBy: string }

export async function orchestrate(input: SpecialistInput, force?: Exclude<SpecialistName, "Orchestrator">): Promise<OrchestrateResult> {
  const r = force ? { specialist: force, reason: "requested" } : await route(input);
  const out = await runSpecialist(r.specialist, input);
  return { ...out, routedBy: r.reason };
}
