import "server-only";
/** WillWriter specialist: multi-turn chat → reply + WillDraft (structured output, zod-validated). */
import type { Content } from "@google/genai";
import type { WillChatMessage, WillDraft } from "../types";
import type { Locale } from "../i18n/locales";
import { generateJson, hasGemini } from "./gemini";
import { replyLanguage, WILL_WRITER } from "./prompts";
import { willDraftChecked, willTurnSchema } from "./schemas";
import { cannedWillTurn } from "./canned";
import { getUsdtZar } from "../fx";

export function toContents(history: WillChatMessage[]): Content[] {
  return history.map((m) => ({ role: m.role === "agent" ? "model" : "user", parts: [{ text: m.text }] }));
}

export async function willChat(history: WillChatMessage[], locale?: Locale): Promise<{ reply: string; draft: WillDraft | null; draftIssues?: string[] }> {
  if (!hasGemini()) return cannedWillTurn(history.filter((m) => m.role === "user").length);
  const fx = await getUsdtZar();
  const turn = await generateJson(willTurnSchema, {
    system: `${WILL_WRITER}\nFX: 1 USD₮ = R${fx.usdtZar.toFixed(2)} (${fx.source}). Today is ${new Date().toISOString().slice(0, 10)}.${replyLanguage(locale)}`,
    contents: toContents(history),
    thinking: "medium",
    timeoutMs: 45_000,
  });
  if (!turn.draft) return { reply: turn.reply, draft: null };
  // Contract-level checks before the owner can sign: surface problems instead of a draft that would fail on-chain.
  const checked = willDraftChecked.safeParse(turn.draft);
  if (checked.success) return { reply: turn.reply, draft: checked.data };
  return {
    reply: `${turn.reply}\n\n(Some rules need fixing before you can sign: ${checked.error.issues.map((i) => i.message).join("; ")}.)`,
    draft: turn.draft,
    draftIssues: checked.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}
