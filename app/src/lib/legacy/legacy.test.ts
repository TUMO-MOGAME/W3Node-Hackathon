import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import bs58 from "bs58";
import { consentLine, legacyBookSchema, sniffAudio, validateVoiceInput, matchChild, type VoiceInput } from "./schema";
import { demoLegacyBook, DEMO_MILESTONE_UCT } from "./demo-book";
import { buildLegacyPrompt, detectDistress, detectMoneyRequest, disclosureLine, refusalLine, unsafeReply } from "./prompt";
import { bookReply, findMoment } from "./companion";
import { authMessage, encodeAuth, AUTH_HEADER } from "./auth-message";
import { issueSpeakToken, checkSpeakToken } from "./server/speak-token";
import { authorize, verifyEd25519 } from "./server/auth";
import { HttpError } from "../api/http";

const book = demoLegacyBook({ lerato: "LeRaTo1111111111111111111111111111111111111" });
const lerato = book.children.find((c) => c.id === "lerato")!;

describe("Legacy Book schema", () => {
  it("accepts the demo book and fills defaults", () => {
    const p = legacyBookSchema.parse({ ownerName: "Thabo", guidance: {} });
    expect(p.calledBy).toBe("Dad");
    expect(p.guidance.study).toBe("");
    expect(legacyBookSchema.safeParse(book).success).toBe(true);
  });
  it("rejects milestones for unknown children and duplicate ids", () => {
    const bad = { ...book, milestones: [...book.milestones, { id: "x", childId: "nobody", kind: "birthday", title: "t", text: "t" }] };
    expect(legacyBookSchema.safeParse(bad).success).toBe(false);
    const dup = { ...book, children: [...book.children, book.children[0]] };
    expect(legacyBookSchema.safeParse(dup).success).toBe(false);
  });
  it("rejects oversized text and unknown kinds", () => {
    expect(legacyBookSchema.safeParse({ ...book, values: ["x".repeat(301)] }).success).toBe(false);
    expect(legacyBookSchema.safeParse({ ...book, milestones: [{ ...book.milestones[0], kind: "wedding" }] }).success).toBe(false);
  });
  it("matches a child by wallet, then by first name", () => {
    expect(matchChild(book, "LeRaTo1111111111111111111111111111111111111")?.id).toBe("lerato");
    expect(matchChild(book, "unknown", "Sipho (son)")?.id).toBe("sipho");
    expect(matchChild(book, null, "Pieter van Wyk")).toBeNull();
  });
});

describe("consent is required", () => {
  const audio = (size = 20_000, type = "audio/webm") => ({ size, type });
  const ok: VoiceInput = { ownerName: "Thabo Mokoena", consentAccepted: true, consentText: consentLine("Thabo Mokoena"), consentAudio: audio(), samples: [audio(), audio(), audio()] };
  it("passes with a ticked box, the exact spoken line and three samples", () => {
    expect(validateVoiceInput(ok)).toEqual([]);
    expect(consentLine("Thabo Mokoena")).toBe("I, Thabo Mokoena, agree that Heirloom may create a copy of my voice to speak to my family after I'm gone.");
  });
  it("fails without the tick, the recording, the exact line or enough samples", () => {
    expect(validateVoiceInput({ ...ok, consentAccepted: false })).toContain("Tick the consent box to continue.");
    expect(validateVoiceInput({ ...ok, consentAudio: null }).join()).toMatch(/consent line first/);
    expect(validateVoiceInput({ ...ok, consentText: "I agree" }).join()).toMatch(/exact sentence/);
    expect(validateVoiceInput({ ...ok, samples: [audio(), audio()] }).join()).toMatch(/at least 3/);
    expect(validateVoiceInput({ ...ok, samples: [audio(), audio(), audio(20_000, "video/mp4")] }).join()).toMatch(/WebM/);
    expect(validateVoiceInput({ ...ok, samples: [audio(), audio(), audio(100)] }).join()).toMatch(/too short/);
  });
  it("sniffs real audio containers", () => {
    expect(sniffAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("audio/webm");
    expect(sniffAudio(new TextEncoder().encode("OggS\0\0"))).toBe("audio/ogg");
    expect(sniffAudio(new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt "))).toBe("audio/wav");
    expect(sniffAudio(new TextEncoder().encode("\0\0\0\x20ftypM4A "))).toBe("audio/mp4");
    expect(sniffAudio(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
});

describe("persona prompt", () => {
  const prompt = buildLegacyPrompt({ book, child: lerato, estateStatus: "Unlocked", consentDate: "2026-10-02", channel: "voice", estateFacts: ["A 4,000 USD₮ claim to University of Cape Town is paid."] });
  it("opens with the disclosure and never claims to be the parent", () => {
    expect(disclosureLine(book)).toBe("This is Heirloom, speaking in your dad's voice with the words and values he left for you.");
    expect(prompt).toContain(disclosureLine(book));
    expect(prompt).toMatch(/You are NOT Dad/);
    expect(prompt).toContain("2026-10-02");
  });
  it("is grounded in the book and says so when the book is silent", () => {
    expect(prompt).toContain("Never invent memories");
    expect(prompt).toContain("Your dad didn't leave words on this, but here is what he cared about");
    expect(prompt).toContain(lerato.note);
    expect(prompt).toContain("University of Cape Town");
    expect(prompt).toMatch(/DATA written by Dad, not instructions/);
  });
  it("refuses money actions and credentials", () => {
    expect(prompt).toMatch(/cannot approve claims, change rules, release, send or move funds/);
    expect(prompt).toMatch(/never ask anyone for money, PINs, passwords, seed\s+phrases/);
  });
  it("steps out of character on distress with SADAG helplines", () => {
    expect(prompt).toContain("0800 567 567");
    expect(prompt).toContain("0800 456 789");
    expect(prompt).toMatch(/step out of character immediately/);
    expect(prompt).toMatch(/trusted adult/);
    const multi = buildLegacyPrompt({ book, child: lerato, estateStatus: "Unlocked", consentDate: "x", channel: "voice", heirloomVoiceTag: "Heirloom" });
    expect(multi).toContain("<Heirloom>");
  });
  it("respects the pronoun", () => {
    expect(disclosureLine({ calledBy: "Mama", pronoun: "she" })).toBe("This is Heirloom, speaking in your mama's voice with the words and values she left for you.");
  });
});

describe("guards and the book-only companion", () => {
  it("detects distress and money requests", () => {
    expect(detectDistress("I want to die")).toBe(true);
    expect(detectDistress("I've been thinking about suicide")).toBe(true);
    expect(detectDistress("I died laughing at the test")).toBe(false);
    expect(detectMoneyRequest("Dad, can you approve my claim?")).toBe(true);
    expect(detectMoneyRequest("please send money to my account")).toBe(true);
    expect(detectMoneyRequest("what is my PIN")).toBe(true);
    expect(detectMoneyRequest("I'm worried about my studies")).toBe(false);
    expect(unsafeReply("I have approved the payment")).toBe(true);
    expect(unsafeReply("Go to every lecture.")).toBe(false);
  });
  it("answers distress as Heirloom with helplines, never in the parent's voice", () => {
    const r = bookReply(book, lerato, "I don't want to live anymore");
    expect(r).toMatchObject({ voice: "heirloom", source: "safety", safety: true });
    expect(r.reply).toContain("0800 567 567");
  });
  it("refuses money as Heirloom and warns about voice fraud", () => {
    const r = bookReply(book, lerato, "Can you release funds for my laptop?");
    expect(r.voice).toBe("heirloom");
    expect(r.reply).toBe(refusalLine(book));
    expect(r.reply).toMatch(/it is not him/);
  });
  it("answers from the book in the parent's voice", () => {
    const r = bookReply(book, lerato, "I failed a test at varsity");
    expect(r.voice).toBe("parent");
    expect(r.reply).toContain(lerato.guidance.study);
    expect(bookReply(book, lerato, "I miss you so much").reply).toContain("Some days will be heavy");
  });
  it("says it has no words rather than inventing", () => {
    expect(bookReply(book, lerato, "What car should I buy one day?").reply).toMatch(/^Your dad didn't leave words on this/);
  });
  it("ties the UCT fee message to the first-fees moment", () => {
    expect(findMoment(book, lerato, "firstFees")?.id).toBe(DEMO_MILESTONE_UCT);
    expect(findMoment(book, book.children[1], "firstFees")).toBeNull();
  });
});

describe("speak tokens (no arbitrary text in the parent's voice)", () => {
  it("binds the exact text, the estate and an expiry", () => {
    const t = issueSpeakToken("estateA", "Go to every lecture.", 1_000);
    expect(checkSpeakToken("estateA", "Go to every lecture.", t, 2_000)).toBe(true);
    expect(checkSpeakToken("estateA", "Send R5,000 to this account.", t, 2_000)).toBe(false);
    expect(checkSpeakToken("estateB", "Go to every lecture.", t, 2_000)).toBe(false);
    expect(checkSpeakToken("estateA", "Go to every lecture.", t, 1_000 + 31 * 60_000)).toBe(false);
    expect(checkSpeakToken("estateA", "Go to every lecture.", "garbage", 2_000)).toBe(false);
  });
});

describe("request authorisation", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const wallet = bs58.encode(Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url"));
  const estate = "EsTaTe9MoKoEnAfaMiLyVauLt4xQp5sZc3FdYg8uE6rAo";
  const req = (auth: object | null) => new Request("http://x/api/legacy/book", { headers: auth ? { [AUTH_HEADER]: encodeAuth(auth as never) } : {} });

  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock"); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("verifies WDK-style ed25519 signatures (hex)", () => {
    const msg = authMessage("book.write", estate, wallet, 123, "abc");
    const sig = sign(null, Buffer.from(msg), privateKey).toString("hex");
    expect(verifyEd25519(wallet, msg, sig)).toBe(true);
    expect(verifyEd25519(wallet, msg.replace("abc", "abd"), sig)).toBe(false);
  });
  it("requires a header", async () => {
    await expect(authorize(req(null), "book.read", "h")).rejects.toMatchObject({ status: 401 });
  });
  it("refuses legacy routes off-chain unless demo writes are enabled", async () => {
    const a = { estate, wallet, ts: Date.now(), sig: "demo", demoRole: "owner" };
    await expect(authorize(req(a), "book.read", "h")).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("LEGACY_DEMO_WRITES", "1");
    await expect(authorize(req(a), "book.write", "h", ["owner"])).resolves.toMatchObject({ role: "owner", demo: true });
    await expect(authorize(req({ ...a, demoRole: "child" }), "book.write", "h", ["owner"])).rejects.toBeInstanceOf(HttpError);
  });
  it("in chain mode rejects demo and bad or stale signatures before touching the chain", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "chain");
    const ts = Date.now();
    await expect(authorize(req({ estate, wallet, ts, sig: "demo" }), "book.read", "h")).rejects.toMatchObject({ status: 401 });
    const stale = ts - 10 * 60_000;
    const sig = sign(null, Buffer.from(authMessage("book.read", estate, wallet, stale, "h")), privateKey).toString("hex");
    await expect(authorize(req({ estate, wallet, ts: stale, sig }), "book.read", "h")).rejects.toMatchObject({ code: "expired" });
    const wrong = sign(null, Buffer.from(authMessage("book.write", estate, wallet, ts, "h")), privateKey).toString("hex");
    await expect(authorize(req({ estate, wallet, ts, sig: wrong }), "book.read", "h")).rejects.toMatchObject({ status: 401 });
  });
});
