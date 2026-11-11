import "server-only";
/**
 * LegacyCompanion specialist (text channel). Deterministic guards run first (distress → safety, money → refusal),
 * then Gemini answers with the persona prompt built from the Legacy Book (lib/legacy/prompt.ts); a reply that
 * tries to act on money or ask for secrets is replaced by the refusal. Without Gemini it answers from the book only.
 * It has NO tools: it cannot navigate, open claims or touch the chain.
 */
import type { WillChatMessage } from "../types";
import { generate, hasGemini } from "./gemini";
import { toContents } from "./will";
import { bookReply } from "../legacy/companion";
import { detectDistress, detectMoneyRequest, refusalLine, safetyLine, unsafeReply } from "../legacy/prompt";
import type { LegacyBook, LegacyChatReply, LegacyChild } from "../legacy/schema";

export interface LegacyContext { book: LegacyBook; child: LegacyChild | null; prompt: string }

export async function legacyCompanion(history: WillChatMessage[], ctx: LegacyContext): Promise<LegacyChatReply> {
  const last = history[history.length - 1]?.text ?? "";
  // Safety: any recent user turn in distress keeps the conversation out of character.
  if (history.slice(-4).some((m) => m.role === "user" && detectDistress(m.text))) {
    return { reply: safetyLine(ctx.book), voice: "heirloom", source: "safety", safety: true };
  }
  if (detectMoneyRequest(last)) return { reply: refusalLine(ctx.book), voice: "heirloom", source: "refusal" };
  if (!hasGemini()) return bookReply(ctx.book, ctx.child, last);
  try {
    const res = await generate({ system: ctx.prompt, contents: toContents(history.slice(-12)), thinking: "low", timeoutMs: 20_000 });
    const text = res.text?.trim();
    if (!text) return bookReply(ctx.book, ctx.child, last);
    if (unsafeReply(text)) return { reply: refusalLine(ctx.book), voice: "heirloom", source: "refusal" };
    return { reply: text.slice(0, 1500), voice: "parent", source: "ai" };
  } catch {
    return bookReply(ctx.book, ctx.child, last);
  }
}
