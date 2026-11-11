import "server-only";
/**
 * Specialists: each has its own system prompt and typed tools (zod-validated function calling).
 * A small tool loop runs Gemini ↔ tools (max 4 rounds); tools may emit UI actions for the app.
 * WillWriter and DocumentReviewer reuse will.ts / review.ts so text, voice and the classic routes
 * all go through the same code.
 */
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { z } from "zod";
import type { SpecialistName } from "../voice/types";
import type { WillChatMessage, WillDraft } from "../types";
import type { Locale } from "../i18n/locales";
import { generate, hasGemini, jsonSchemaOf } from "./gemini";
import { CAR_BROKER, CLAIMS_GUIDE, COMPLIANCE, DOCUMENT_REVIEWER, ESTATE_GUIDE, replyLanguage } from "./prompts";
import { uiActionSchema, type UiAction } from "./actions";
import { checkClaim, type EstateFacts } from "./facts";
import { rankOffers } from "./offers";
import { toBase } from "../format";
import { willChat, toContents } from "./will";
import { valueCar } from "./valuation";
import { CANNED_PREFIX } from "./canned";
import { legacyCompanion, type LegacyContext } from "./legacy-companion";

export interface SpecialistInput {
  history: WillChatMessage[];          // last message is the user's
  facts: EstateFacts | null;
  context: { persona?: string; role?: string; page?: string; channel?: "text" | "voice"; locale?: Locale };
  /** Only for LegacyCompanion: the server-verified Legacy Book, child and persona prompt. */
  legacy?: LegacyContext;
}

export interface SpecialistResult {
  specialist: SpecialistName;
  reply: string;
  actions: UiAction[];
  draft?: WillDraft | null;
  needsHuman?: string[];
  /** LegacyCompanion only: which voice should speak the reply, and why. */
  legacy?: { voice: "parent" | "heirloom"; source: "book" | "ai" | "safety" | "refusal"; safety?: boolean };
}

interface Tool<A extends z.ZodType> {
  name: string;
  description: string;
  params: A;
  run(args: z.infer<A>, st: RunState): Promise<unknown> | unknown;
}
interface RunState { facts: EstateFacts | null; actions: UiAction[]; needsHuman: string[] }

// Helper to keep each tool's args typed while storing them in one array.
const tool = <A extends z.ZodType>(t: Tool<A>) => t as unknown as Tool<z.ZodType>;

const noEstate = { error: "No estate data is available in this session. Ask the user to open their estate first." };

const navigate = tool({
  name: "navigate", description: "Open a screen in the app. Paths: /owner, /family, /verifier, /buyer, /audit, or a path the user is on.",
  params: z.object({ path: z.string().regex(/^\/[\w\-/]*$/).max(100) }),
  run: (a, st) => { st.actions.push({ type: "navigate", path: a.path }); return { ok: true }; },
});

const showRule = tool({
  name: "show_rule", description: "Highlight a rule on screen by its address.",
  params: z.object({ rule: z.string().max(64) }),
  run: (a, st) => { st.actions.push({ type: "showRule", rule: a.rule }); return { ok: true }; },
});

const startUpload = tool({
  name: "start_upload", description: "Open the document upload for a death certificate, a claim's evidence or a hardship affidavit.",
  params: z.object({ purpose: z.enum(["death", "claim", "hardship"]) }),
  run: (a, st) => { st.actions.push({ type: "startUpload", purpose: a.purpose }); return { ok: true }; },
});

const getStatus = tool({
  name: "get_estate_status", description: "Read the current estate snapshot: status, vault, death process, rules, claims, car, offers, recent activity.",
  params: z.object({}),
  run: (_a, st) => st.facts ?? noEstate,
});

const listRules = tool({
  name: "list_rules", description: "List payout rules with caps, remaining amounts and the approved payees.",
  params: z.object({}),
  run: (_a, st) => st.facts ? { rules: st.facts.rules, payees: st.facts.payees } : noEstate,
});

const checkClaimTool = tool({
  name: "check_claim", description: "Check whether a claim would pass the contract's caps before submitting it.",
  params: z.object({ ruleId: z.number().int().min(0), amountUsdt: z.number().positive(), payeeWallet: z.string().max(64).optional() }),
  run: (a, st) => st.facts ? checkClaim(st.facts, a.ruleId, a.amountUsdt, a.payeeWallet) : noEstate,
});

const openClaimForm = tool({
  name: "open_claim_form", description: "Open the claim form prefilled with the rule address, payee wallet and amount in USD₮.",
  params: z.object({ rule: z.string().max(64).optional(), payee: z.string().max(64).optional(), amount: z.number().positive().optional() }),
  run: (a, st) => { st.actions.push(uiActionSchema.parse({ type: "openClaimForm", ...a })); return { ok: true }; },
});

const rankOffersTool = tool({
  name: "rank_offers", description: "Rank the car offers against the floor (or hardship floor). Deterministic, same rule as the contract.",
  params: z.object({}),
  run: (_a, st) => {
    const f = st.facts;
    if (!f?.asset) return noEstate;
    const r = rankOffers(
      { floorPrice: toBase(f.asset.floorUsdt), hardshipFloor: toBase(f.asset.hardshipFloorUsdt), hardshipBeneficiary: f.asset.hardshipApproved ? "approved" : null, status: f.asset.status as "Held" | "Listed" | "Sold" },
      f.offers.map((o) => ({ address: o.address, buyer: o.buyer, amount: toBase(o.amountUsdt), createdAt: o.createdAt })),
    );
    const fmt = (x: { offer: string; amount: bigint; reason: string }) => ({ offer: x.offer, amountUsdt: Number(x.amount) / 1e6, reason: x.reason });
    return { bestOffer: r.bestOffer, eligible: r.eligible.map(fmt), ineligible: r.ineligible.map(fmt) };
  },
});

const valueCarTool = tool({
  name: "value_car", description: "Value a car from public South African listings (web search). Returns a USD₮ range.",
  params: z.object({ make: z.string().max(40), model: z.string().max(60), year: z.number().int(), mileageKm: z.number().int().min(0), condition: z.string().max(100) }),
  run: async (a) => {
    const v = await valueCar(a);
    return { ...v, comparables: v.comparables.slice(0, 5) };
  },
});

const flagForHuman = tool({
  name: "flag_for_human", description: "Flag that this question needs a lawyer, the executor or a human verifier.",
  params: z.object({ reason: z.string().max(300) }),
  run: (a, st) => { st.needsHuman.push(a.reason); return { flagged: true }; },
});

const SPECS: Record<Exclude<SpecialistName, "Orchestrator" | "WillWriter" | "LegacyCompanion">, { system: string; tools: Tool<z.ZodType>[] }> = {
  DocumentReviewer: { system: `${DOCUMENT_REVIEWER}\nIn conversation (no file attached yet): explain which document is needed and what it must show, then call start_upload.`, tools: [startUpload, getStatus] },
  ClaimsGuide: { system: CLAIMS_GUIDE, tools: [listRules, checkClaimTool, openClaimForm, showRule, startUpload] },
  CarBroker: { system: CAR_BROKER, tools: [getStatus, rankOffersTool, valueCarTool, navigate] },
  EstateGuide: { system: ESTATE_GUIDE, tools: [getStatus, showRule, navigate] },
  Compliance: { system: COMPLIANCE, tools: [flagForHuman] },
};

function contextLine(i: SpecialistInput): string {
  const c = i.context;
  return `Session: persona=${c.persona ?? "unknown"}, role=${c.role ?? "unknown"}, page=${c.page ?? "unknown"}, estate=${i.facts?.estate.address ?? "none"}. Today: ${new Date().toISOString().slice(0, 10)}.` +
    (c.channel === "voice" ? " This answer will be SPOKEN: at most 3 short sentences, no lists, no markdown, say amounts in words-friendly form." : "") +
    replyLanguage(c.locale);
}

export async function runSpecialist(name: Exclude<SpecialistName, "Orchestrator">, input: SpecialistInput): Promise<SpecialistResult> {
  if (name === "LegacyCompanion") {
    // Never routed automatically: only the legacy routes call it, with a verified book and child.
    if (!input.legacy) return { specialist: name, reply: "The legacy voice is not available in this conversation.", actions: [] };
    const r = await legacyCompanion(input.history, input.legacy);
    return { specialist: name, reply: r.reply, actions: [], legacy: { voice: r.voice, source: r.source, safety: r.safety } };
  }
  if (name === "WillWriter") {
    const r = await willChat(input.history, input.context.locale);
    return { specialist: name, reply: r.reply, draft: r.draft, actions: [] };
  }
  if (!hasGemini()) return cannedSpecialist(name, input);

  const spec = SPECS[name];
  const st: RunState = { facts: input.facts, actions: [], needsHuman: [] };
  const decls: FunctionDeclaration[] = spec.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: jsonSchemaOf(t.params) }));
  const contents: Content[] = toContents(input.history);

  for (let round = 0; round < 4; round++) {
    const res = await generate({
      system: `${spec.system}\n${contextLine(input)}`,
      contents,
      thinking: "low",
      timeoutMs: 25_000,
      config: { tools: [{ functionDeclarations: decls }] },
    });
    const calls = res.functionCalls ?? [];
    if (calls.length === 0) {
      return { specialist: name, reply: res.text?.trim() || "Sorry, I could not find an answer to that.", actions: st.actions, needsHuman: st.needsHuman };
    }
    const modelContent = res.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);
    const responses: Part[] = [];
    for (const call of calls) {
      const t = spec.tools.find((x) => x.name === call.name);
      let response: Record<string, unknown>;
      if (!t) response = { error: `Unknown tool ${call.name}` };
      else {
        const args = t.params.safeParse(call.args ?? {});
        try {
          response = args.success ? { result: await t.run(args.data, st) } : { error: `Invalid arguments: ${args.error.issues[0]?.message}` };
        } catch (e) {
          response = { error: e instanceof Error ? e.message : "Tool failed" };
        }
      }
      responses.push({ functionResponse: { id: call.id, name: call.name ?? "unknown", response } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { specialist: name, reply: "I need a human to look at this one. Please ask a verifier.", actions: st.actions, needsHuman: st.needsHuman };
}

function cannedSpecialist(name: Exclude<SpecialistName, "Orchestrator" | "WillWriter" | "LegacyCompanion">, input: SpecialistInput): SpecialistResult {
  const f = input.facts;
  const text: Record<typeof name, string> = {
    DocumentReviewer: "Please upload the document as a PDF, JPG or PNG. A person will check it because the AI reviewer is not configured.",
    ClaimsGuide: f?.rules.length
      ? `You have ${f.rules.length} rule(s). For example rule #${f.rules[0].id} (${f.rules[0].category}) allows up to ${f.rules[0].maxPerClaimUsdt} USD₮ per claim, ${f.rules[0].remainingUsdt} USD₮ left in total.`
      : "Open your estate to see your rules and caps.",
    CarBroker: f?.asset ? `The car's floor price is ${f.asset.floorUsdt} USD₮; offers below it are blocked by the contract.` : "No car is registered yet.",
    EstateGuide: f ? `The estate is ${f.estate.status}. The vault holds ${f.estate.vaultUsdt.toFixed(2)} USD₮.` : "Open your estate to see its status.",
    Compliance: "Your documents stay off-chain in a private store; only their SHA-256 fingerprints go on-chain. Heirloom works next to a signed paper will, it does not replace it.",
  };
  const actions: UiAction[] = name === "DocumentReviewer" ? [{ type: "startUpload", purpose: "claim" }] : [];
  return { specialist: name, reply: CANNED_PREFIX + text[name], actions };
}
