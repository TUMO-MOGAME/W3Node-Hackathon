/**
 * Book-only companion: answers strictly from the Legacy Book, with no AI model. Used by the mock service and
 * as the server fallback when Gemini is not configured. Same guards as the model path (./prompt.ts).
 */
import { detectDistress, detectMoneyRequest, noWordsLine, refusalLine, safetyLine } from "./prompt";
import { milestonesFor, type Guidance, type LegacyBook, type LegacyChatReply, type LegacyChild, type Milestone, type MilestoneKind } from "./schema";

const TOPICS: [keyof Guidance, RegExp][] = [
  ["study", /\b(stud(y|ies|ying)|exam|test|school|varsity|university|uct|marks?|fail(ed)?|lecture|degree|homework|class)\b/i],
  ["money", /\b(money|budget|sav(e|ing)|spend|debt|loan|salary|allowance|rent|afford|broke)\b/i],
  ["faith", /\b(church|pray(er)?|god|faith|culture|ancestors?|tradition|heritage|sunday)\b/i],
  ["family", /\b(sister|brother|family|mom|mother|mama|uncle|aunt|cousin|fight|argu(e|ment)|home)\b/i],
];

const MOMENTS: [MilestoneKind, RegExp][] = [
  ["hardDay", /\b(miss you|sad|lonely|hard day|cry(ing)?|griev\w*|scared|tired|lost)\b/i],
  ["graduation", /\bgraduat\w*\b/i],
  ["firstJob", /\b(first job|new job|got a job|hired|interview)\b/i],
  ["birthday", /\bbirthday\b/i],
  ["firstFees", /\b(fees? (were |was |got )?paid|registered|registration)\b/i],
];

export function findMoment(book: LegacyBook, child: LegacyChild | null, kind: MilestoneKind): Milestone | null {
  const list = milestonesFor(book, child?.id ?? null).filter((m) => m.kind === kind);
  return list.find((m) => m.childId === child?.id) ?? list[0] ?? null;
}

/** Answers from the book only. Never invents: falls back to "didn't leave words on this" + a value. */
export function bookReply(book: LegacyBook, child: LegacyChild | null, text: string): LegacyChatReply {
  if (detectDistress(text)) return { reply: safetyLine(book), voice: "heirloom", source: "safety", safety: true };
  if (detectMoneyRequest(text)) return { reply: refusalLine(book), voice: "heirloom", source: "refusal" };

  for (const [kind, re] of MOMENTS) {
    if (!re.test(text)) continue;
    const m = findMoment(book, child, kind);
    if (m) return { reply: m.text, voice: "parent", source: "book" };
  }
  const phrase = book.phrases.length ? book.phrases[Math.abs(hash(text)) % book.phrases.length] : null;
  for (const [topic, re] of TOPICS) {
    if (!re.test(text)) continue;
    const mine = child?.guidance[topic];
    const all = book.guidance[topic];
    const words = [mine, all].filter(Boolean).join(" ");
    if (words) return { reply: phrase ? `${words} And remember what I always say: ${phrase}` : words, voice: "parent", source: "book" };
  }
  const value = book.values[0] ?? book.lessons[0];
  const name = child?.name.split(" ")[0];
  if (value) return { reply: `${noWordsLine(book)}: ${value}${name && child?.note ? ` And ${name}, ${lowerFirst(child.note)}` : ""}`, voice: "parent", source: "book" };
  return { reply: `${noWordsLine(book)}. Please talk to the family about it.`, voice: "parent", source: "book" };
}

function lowerFirst(s: string) { return s ? s[0].toLowerCase() + s.slice(1) : s; }
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
