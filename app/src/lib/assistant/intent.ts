/**
 * Wallet assistant intent: "send R500 to Lerato for books" → { action, recipient, amountUsdt | amountZar, memo }.
 * Client-safe (no server imports). The same zod schema validates both engines:
 *  - Tether QVAC (local LLM, constrained to WALLET_INTENT_JSON_SCHEMA; see ./qvac.ts)
 *  - the deterministic fallback parser below (hosted demo, no model, poor connection)
 * An intent is only a suggestion: planSend() resolves it against saved recipients and the live rate,
 * and the payment still goes through reviewSend → the review sheet → the person approves → WDK signs.
 */
import { z } from "zod";

export const walletIntentSchema = z.object({
  action: z.enum(["send", "unknown"]),
  recipient: z.string().trim().max(80).nullable(),
  amountUsdt: z.number().positive().max(1_000_000).nullable(),
  amountZar: z.number().positive().max(20_000_000).nullable(),
  memo: z.string().trim().max(120).nullable(),
});
export type WalletIntent = z.infer<typeof walletIntentSchema>;

/** JSON Schema handed to QVAC's `responseFormat: json_schema` so sampling can only produce this shape. */
export const WALLET_INTENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["send", "unknown"] },
    recipient: { type: ["string", "null"] },
    amountUsdt: { type: ["number", "null"] },
    amountZar: { type: ["number", "null"] },
    memo: { type: ["string", "null"] },
  },
  required: ["action", "recipient", "amountUsdt", "amountZar", "memo"],
  additionalProperties: false,
} as const;

export type IntentEngine = "qvac" | "fallback";

export interface RecipientLike { label: string; address: string; relationship?: string }

const EMPTY: WalletIntent = { action: "unknown", recipient: null, amountUsdt: null, amountZar: null, memo: null };
const HONORIFIC = /^(adv\.?|ms\.?|mr\.?|mrs\.?|dr\.?|uncle|aunt|auntie|gogo|mkhulu)$/i;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const NUM = String.raw`(\d+(?:[ ,]\d{3})*(?:\.\d{1,2})?)(\s?k\b)?`;
const ZAR_PATTERNS = [new RegExp(String.raw`\bR\s?${NUM}`, "i"), new RegExp(String.raw`${NUM}\s?(?:zar|rands?)\b`, "i")];
const USDT_PATTERNS = [
  new RegExp(String.raw`\$\s?${NUM}`, "i"),
  new RegExp(String.raw`\b(?:usdt|usd₮|usd)\s?${NUM}`, "i"),
  new RegExp(String.raw`${NUM}\s?(?:usdt|usd₮|usd|dollars?|tether)(?![\w₮])`, "i"),
];
const BARE = new RegExp(String.raw`(?:^|\s)${NUM}(?=\s|$|[.,!?])`, "i");

function toNumber(digits: string, k?: string): number {
  const n = Number(digits.replace(/[ ,]/g, ""));
  return Math.round((k ? n * 1000 : n) * 100) / 100;
}

function firstMatch(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return toNumber(m[1], m[2]);
  }
  return null;
}

/** Every number written in the text, for checking a model's amount is grounded in what the person typed. */
export function numbersIn(text: string): number[] {
  return Array.from(text.matchAll(new RegExp(NUM, "gi")), (m) => toNumber(m[1], m[2]));
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();

function nameTokens(label: string): string[] {
  return norm(label.replace(/\(.*?\)/g, "")).split(" ").filter((t) => t.length > 1 && !HONORIFIC.test(t));
}

function relationWords(r: RecipientLike): string[] {
  const rel = norm(`${r.relationship ?? ""} ${(r.label.match(/\((.*?)\)/)?.[1] ?? "")}`);
  return rel.split(" ").filter((t) => t.length > 2 && !/^\d+$/.test(t));
}

/** Finds which saved recipient(s) the text refers to: full name > first or last name > "my daughter". */
export function matchRecipients(query: string, recipients: RecipientLike[]): RecipientLike[] {
  const q = norm(query);
  if (!q) return [];
  const words = new Set(q.split(" "));
  const scored = recipients.map((r) => {
    const tokens = nameTokens(r.label);
    let score = 0;
    if (tokens.length && q.includes(tokens.join(" "))) score = 3;
    else if (tokens[0] && words.has(tokens[0])) score = 2;
    else if (tokens.slice(1).some((t) => words.has(t)) && tokens.length > 1) score = 1.5;
    else if (relationWords(r).some((w) => words.has(w) || words.has(`${w}s`))) score = 1;
    return { r, score };
  }).filter((x) => x.score > 0);
  if (!scored.length) return [];
  const best = Math.max(...scored.map((x) => x.score));
  return scored.filter((x) => x.score === best).map((x) => x.r);
}

const SEND_VERB = /\b(send|pay|give|transfer|e-?wallet|sendi|thumela)\b/i;

/**
 * Deterministic parser: send/pay/give/transfer; R / ZAR / rand / USDT / USD₮ / $ / dollars; names from saved
 * recipients (or the words after "to"); "for <memo>". A bare number is read as USD₮, the wallet's currency.
 */
export function parseIntentFallback(text: string, recipients: RecipientLike[] = []): WalletIntent {
  const t = text.trim().slice(0, 500);
  if (!t) return EMPTY;
  const amountZar = firstMatch(t, ZAR_PATTERNS);
  const amountUsdt = amountZar === null ? firstMatch(t, USDT_PATTERNS) ?? firstMatch(t, [BARE]) : null;

  let recipient: string | null = null;
  const address = t.split(/\s+/).find((w) => SOLANA_ADDRESS.test(w));
  const matched = matchRecipients(t, recipients);
  if (address) recipient = address;
  else if (matched.length === 1) recipient = matched[0].label;
  else {
    const m = t.match(/\bto\s+(?:my\s+)?([\p{L}][\p{L}'.-]*(?:\s+[\p{Lu}][\p{L}'.-]*)?)/u);
    if (m && !/^(the|a|an|pay|send|buy)$/i.test(m[1])) recipient = m[1].trim();
    else if (matched.length > 1) recipient = t.match(/\bmy\s+([\p{L}]+)/u)?.[1] ?? matched[0].label;
  }

  const memoMatch = t.match(/\b(?:for|memo:?|note:?|reference:?|ref:?)\s+(.+?)(?:\s+\bto\b\s+.*)?[.!?]*$/i);
  let memo = memoMatch?.[1]?.trim() ?? null;
  // "for Lerato" / "for my son" names the person, not the reason.
  const personWords = new Set(recipients.flatMap((r) => [...nameTokens(r.label), ...relationWords(r)]).concat("my", "me"));
  if (memo && (norm(memo) === norm(recipient ?? "") || norm(memo).split(" ").every((w) => personWords.has(w)))) memo = null;
  if (memo) memo = memo.replace(new RegExp(String.raw`\s*(?:\bR\s?)?${NUM}\s*(?:zar|rands?|usdt|usd₮|usd|dollars?)?\s*$`, "i"), "").trim() || null;

  const action = SEND_VERB.test(t) || (recipient && (amountZar ?? amountUsdt)) ? "send" : "unknown";
  return walletIntentSchema.parse({ action, recipient, amountUsdt, amountZar, memo: memo?.slice(0, 120) ?? null });
}

/**
 * Keeps a model's answer honest: if it invents an amount that is not in the text, or a recipient that
 * is neither a saved person nor in the text, the deterministic reading is used for that field.
 */
export function groundIntent(model: WalletIntent, text: string, recipients: RecipientLike[] = []): WalletIntent {
  const fb = parseIntentFallback(text, recipients);
  const nums = numbersIn(text);
  const grounded = (n: number | null) => n === null || nums.length === 0 || nums.includes(n);
  const out = { ...model };
  if (!grounded(out.amountUsdt) || !grounded(out.amountZar) || (out.amountUsdt === null && out.amountZar === null)) {
    out.amountUsdt = fb.amountUsdt; out.amountZar = fb.amountZar;
  }
  if (out.amountUsdt !== null && out.amountZar !== null) {
    // Both set: the currency the person actually wrote wins.
    if (fb.amountZar !== null) out.amountUsdt = null; else out.amountZar = null;
  }
  const inText = out.recipient ? norm(text).includes(norm(out.recipient)) : false;
  if (!out.recipient || (!inText && matchRecipients(out.recipient, recipients).length === 0)) out.recipient = fb.recipient;
  if (out.action === "unknown" && fb.action === "send") out.action = "send";
  return walletIntentSchema.parse(out);
}

export type SendPlan =
  | { ok: true; to: string; toLabel: string; amountUsdt: number; amountZar: number | null; memo: string | null }
  | { ok: false; reason: "not_send" | "no_recipient" | "ambiguous" | "no_amount" | "no_rate"; candidates?: RecipientLike[]; intent: WalletIntent };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The app's check of the details: who exactly, how much in USD₮ (ZAR converted at the live rate). */
export function planSend(intent: WalletIntent, recipients: RecipientLike[], usdtZar: number | null): SendPlan {
  if (intent.action !== "send") return { ok: false, reason: "not_send", intent };
  let to: RecipientLike | null = null;
  if (intent.recipient && SOLANA_ADDRESS.test(intent.recipient)) {
    to = recipients.find((r) => r.address === intent.recipient) ?? { label: "", address: intent.recipient };
  } else if (intent.recipient) {
    const found = matchRecipients(intent.recipient, recipients);
    if (found.length > 1) return { ok: false, reason: "ambiguous", candidates: found, intent };
    to = found[0] ?? null;
  }
  if (!to) return { ok: false, reason: "no_recipient", intent };
  let amountUsdt = intent.amountUsdt;
  if (amountUsdt === null && intent.amountZar !== null) {
    if (!usdtZar || usdtZar <= 0) return { ok: false, reason: "no_rate", intent };
    amountUsdt = round2(intent.amountZar / usdtZar);
  }
  if (!amountUsdt || amountUsdt <= 0) return { ok: false, reason: "no_amount", intent };
  return { ok: true, to: to.address, toLabel: to.label, amountUsdt, amountZar: intent.amountZar, memo: intent.memo };
}

/** Cheap check the chat uses to decide whether a message is a payment request worth parsing. */
export function looksLikeSend(text: string): boolean {
  return SEND_VERB.test(text) && (numbersIn(text).length > 0 || /\bto\b/i.test(text));
}
