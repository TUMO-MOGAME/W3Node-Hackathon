/**
 * Legacy voice in mock mode. Same rules as the server (owner-only writes while the estate is active, consent
 * required, children only after unlock + opt-in, money refused, distress → helplines), with a SIMULATED voice:
 * the browser's speech synthesis stands in and the UI labels it "Simulated voice: the real voice needs ElevenLabs".
 *
 * On a demo deployment with ELEVENLABS_API_KEY and LEGACY_DEMO_WRITES=1, the same calls go to the real
 * /api/legacy/* routes (demo auth: role taken from the demo persona), so the real cloned voice can be heard.
 */
import type { Base58, Estate, Role } from "../types";
import type { EstateSnapshot } from "./types";
import { bookReply } from "../legacy/companion";
import { demoLegacyBook } from "../legacy/demo-book";
import { legacyApi, type LegacySigner } from "../legacy/client";
import {
  consentLine, legacyBookSchema, matchChild, validateVoiceInput,
  type LegacyBook, type LegacyStatus, type LegacyVoiceInfo,
} from "../legacy/schema";
import type { HeirloomService } from "./types";

type LegacyMethods = Pick<HeirloomService,
  "legacyStatus" | "createLegacyVoice" | "deleteLegacyVoice" | "saveLegacyBook" | "deleteLegacyBook" | "setLegacyOptIn" | "legacyChat" | "legacySpeak" | "legacyCall">;

interface Deps {
  actor(): { address: Base58; role: Role; label: string } | null;
  estate(): Estate;
  snap(): EstateSnapshot;
  created(): boolean;
  wallets: Record<"lerato" | "sipho" | "naledi", Base58>;
}

interface LocalState { v: 1; voice: LegacyVoiceInfo | null; book: LegacyBook | null; optIns: Record<string, boolean> }

const KEY = "heirloom.mock.legacy.v1";
/** The demo voice was "recorded" by Thabo on 2 October 2026. */
const DEMO_CONSENTED_AT = Date.UTC(2026, 9, 2, 9, 30);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class LegacyError extends Error {
  constructor(public code: string, message: string) { super(`${code}: ${message}`); }
}
const fail = (code: string, msg: string): never => { throw new LegacyError(code, msg); };

export function createMockLegacy(d: Deps): LegacyMethods & { resetLegacy(): void } {
  const seed = (): LocalState => ({
    v: 1,
    voice: { ownerName: "Thabo Mokoena", consentedAt: DEMO_CONSENTED_AT, samples: 4, simulated: true, liveCall: false },
    book: demoLegacyBook(d.wallets),
    optIns: {},
  });
  let st: LocalState = seed();
  if (typeof window !== "undefined") {
    try { const raw = window.localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw) as LocalState; if (p.v === 1) st = p; } } catch { /* stay in memory */ }
  }
  const save = () => { try { window.localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ } };

  const me = () => d.actor() ?? fail("NoWallet", "Choose who you are acting as first.");
  const isOwner = () => !d.created() ? me().role === "owner" : me().address === d.estate().owner;
  const isChild = () => d.created() && d.snap().beneficiaries.some((b) => b.wallet === me().address && b.active);
  const unlocked = () => d.created() && d.estate().status === "Unlocked";
  const needOwner = () => { if (!isOwner()) fail("NotOwner", "Only the estate owner can do this."); };
  const needAlive = () => { if (d.created() && d.estate().status !== "Active") fail("BadStatus", "A legacy voice can only be created by the owner while the estate is active."); };
  const child = () => (st.book ? matchChild(st.book, me().address, me().label) : null);
  const needTalk = () => {
    if (isOwner()) return;
    if (!isChild()) fail("NotBeneficiary", "Only a named family member can do this.");
    if (!unlocked()) fail("Locked", "The legacy voice opens once the estate unlocks.");
    if (!st.optIns[me().address]) fail("NotOptedIn", "Switch the legacy voice on first.");
  };

  /* ----- optional real backend on a demo deployment ----- */
  let remote: Promise<boolean> | null = null;
  const useRemote = () => {
    if (typeof window === "undefined") return Promise.resolve(false);
    remote ??= legacyApi.probe().then((p) => p.available && p.elevenlabs).catch(() => false);
    return remote;
  };
  const signer = (as?: "owner"): LegacySigner => {
    const a = me();
    return { estate: d.estate().address, wallet: a.address, sign: async () => "demo", demoRole: as ?? (isOwner() ? "owner" : "child"), demoLabel: a.label };
  };

  return {
    resetLegacy() { st = seed(); save(); },

    async legacyStatus() {
      if (await useRemote()) {
        let s = await legacyApi.status(signer());
        if (!s.book) { await legacyApi.saveBook(signer("owner"), demoLegacyBook(d.wallets)); s = await legacyApi.status(signer()); }
        return { ...s, unlocked: s.viewer === "owner" ? true : unlocked() };
      }
      await sleep(150);
      const owner = isOwner();
      const optedIn = owner || Boolean(st.optIns[me().address]);
      const open = owner || (unlocked() && optedIn);
      const out: LegacyStatus = {
        voice: st.voice, optedIn, viewer: owner ? "owner" : isChild() ? "child" : "other",
        book: st.book ? (open ? structuredClone(st.book) : { ...st.book, values: [], lessons: [], phrases: [], children: [], milestones: [], guidance: { study: "", money: "", faith: "", family: "", other: "" } }) : null,
        childId: child()?.id ?? null, unlocked: unlocked(),
      };
      return out;
    },

    async createLegacyVoice(_e, input) {
      needOwner(); needAlive();
      const problems = validateVoiceInput({
        ownerName: input.ownerName, consentAccepted: input.consentAccepted, consentText: input.consentText,
        consentAudio: input.consent ? { size: input.consent.size, type: input.consent.type } : null,
        samples: input.samples.map((b) => ({ size: b.size, type: b.type })),
      });
      if (problems.length) fail("Invalid", problems[0]);
      if (input.consentText !== consentLine(input.ownerName)) fail("Invalid", "The consent line must be the exact sentence shown.");
      if (await useRemote()) { const v = await legacyApi.createVoice(signer("owner"), input); st.voice = v; save(); return v; }
      await sleep(1800); // "creating the voice"
      st.voice = { ownerName: input.ownerName.trim(), consentedAt: Date.now(), samples: input.samples.length, simulated: true, liveCall: false };
      save();
      return st.voice;
    },

    async deleteLegacyVoice() {
      needOwner();
      if (await useRemote()) await legacyApi.deleteVoice(signer("owner"));
      await sleep(600);
      st.voice = null; save();
    },

    async saveLegacyBook(_e, book) {
      needOwner(); needAlive();
      const parsed = legacyBookSchema.parse(book);
      if (await useRemote()) { const b = await legacyApi.saveBook(signer("owner"), parsed); st.book = b; save(); return b; }
      await sleep(500);
      st.book = parsed; save();
      return parsed;
    },

    async deleteLegacyBook() {
      needOwner();
      if (await useRemote()) await legacyApi.deleteBook(signer("owner"));
      await sleep(400);
      st.book = null; save();
    },

    async setLegacyOptIn(_e, on) {
      if (!isChild()) fail("NotBeneficiary", "Only a named family member can do this.");
      if (await useRemote()) await legacyApi.optIn(signer(), on);
      await sleep(250);
      st.optIns = { ...st.optIns, [me().address]: on }; save();
    },

    async legacyChat(_e, history, opts) {
      needTalk();
      if (await useRemote()) return legacyApi.chat(signer(), history, opts?.previewChildId);
      if (!st.book) fail("NoBook", "There is no Legacy Book.");
      await sleep(700);
      const kid = isOwner() ? st.book!.children.find((c) => c.id === opts?.previewChildId) ?? null : child();
      const last = [...history].reverse().find((m) => m.role === "user")?.text ?? "";
      return bookReply(st.book!, kid, last);
    },

    async legacySpeak(_e, input, voice = "parent") {
      needTalk();
      if (await useRemote() && voice === "parent") return legacyApi.speak(signer(), input, voice);
      if (!st.voice && voice === "parent") fail("NoVoice", "No legacy voice has been created.");
      let text: string;
      if ("milestoneId" in input) {
        const m = st.book?.milestones.find((x) => x.id === input.milestoneId);
        if (!m) fail("NotFound", "That message was not found.");
        text = m!.text;
      } else text = input.text;
      return { text, audioUrl: null, simulated: true, voice };
    },

    async legacyCall(_e, opts) {
      needTalk();
      if (await useRemote()) {
        try { return await legacyApi.session(signer(), opts?.previewChildId); }
        catch { return null; }
      }
      return null;
    },
  };
}
