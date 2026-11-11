/**
 * HeirloomService on Solana devnet. Writes: build instructions → unsigned base64 tx → the active Tether WDK
 * wallet signs and sends (wallet/signer.ts, kept in sync by <WalletProvider>) → confirm. Reads: RPC + decoders.
 * Agent actions (reviews, listing, accepting offers, valuation, chat) go through our API routes, where the
 * agent's own WDK wallet signs only review_* / list_asset / accept_offer.
 */
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import type { HeirloomService, EstateSnapshot, TxResult } from "./types";
import type {
  AgentReport, Base58, CarValuation, FxRate, OfferRanking, WillChatMessage, WillDraft,
} from "../types";
import { chainCtx, prepareTx } from "../chain/client";
import * as ix from "../chain/instructions";
import { claimPda, estatePda, offerPda, hardshipPda } from "../chain/pda";
import { confirmOrThrow, getConnection } from "../chain/tx";
import { fetchAccountRaw, fetchActivity, fetchEstateRaw, findEstateOf } from "../chain/reads";
import { assembleSnapshot } from "../chain/snapshot";
import { key, num, type Raw } from "../chain/decoders";
import { accountDiscriminator, getIdl } from "../chain/idl";
import { getActiveSigner } from "../wallet/signer";
import { explorerTx, toBase } from "../format";
import { hashJson, sha256Hex } from "../agent/hash";
import { intervalSecs, willDraftSchema } from "../agent/schemas";
import type { EstateMeta } from "../db";
import bs58 from "bs58";

// ---------- small helpers ----------
const pk = (a: string) => new PublicKey(a);

async function send(ixs: TransactionInstruction[]): Promise<TxResult> {
  const signer = getActiveSigner();
  const b64 = await prepareTx(signer.address, ixs);
  const signature = await signer.signAndSend(b64);
  await confirmOrThrow(signature);
  return { signature, explorerUrl: explorerTx(signature) };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const fileHash = async (f: File) => sha256Hex(new Uint8Array(await f.arrayBuffer()));

/** OfferRanking amounts come back from JSON as strings. */
function reviveRanking(r: { bestOffer: Base58 | null; eligible: { offer: Base58; amount: string; reason: string }[]; ineligible: { offer: Base58; amount: string; reason: string }[] }): OfferRanking {
  const f = (x: { offer: Base58; amount: string; reason: string }) => ({ ...x, amount: BigInt(x.amount) });
  return { bestOffer: r.bestOffer, eligible: r.eligible.map(f), ineligible: r.ineligible.map(f) };
}

async function review(file: File, purpose: "death" | "claim" | "hardship", estate: Base58, context: string, subject?: Base58, preview = false) {
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", purpose);
  form.set("estate", estate);
  form.set("context", context);
  if (subject) form.set("subject", subject);
  if (preview) form.set("preview", "1");
  return api<{ report: AgentReport; tx: TxResult | null; onChain: string }>("/api/review", { method: "POST", body: form });
}

function requireOwnerOf(estate: Base58): PublicKey {
  const me = getActiveSigner().address;
  if (estatePda(chainCtx().programId, me).toBase58() !== estate) throw new Error("Switch to the estate owner's wallet to do this.");
  return pk(me);
}

async function mustFetch(type: string, address: Base58): Promise<Raw> {
  const raw = await fetchAccountRaw(type, address);
  if (!raw) throw new Error(`${type} ${address.slice(0, 6)}… was not found on-chain.`);
  return raw;
}

const DEMO_WAIT = Number(process.env.NEXT_PUBLIC_DEMO_WAITING_SECS ?? "");

async function getMeta(estate: Base58): Promise<EstateMeta | null> {
  return api<EstateMeta | null>(`/api/estate-meta?estate=${estate}`).catch(() => null);
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

// ---------- the service ----------
export function createChainService(): HeirloomService {
  return {
    mode: "chain",

    async getEstate(estate): Promise<EstateSnapshot> {
      const meta = await getMeta(estate);
      const raw = await fetchEstateRaw(estate, meta ?? {});
      const hashes = [...new Set(Object.values(raw.reportHashes))];
      const [activity, reports] = await Promise.all([
        fetchActivity(estate).catch(() => []),
        hashes.length ? api<Record<string, AgentReport>>(`/api/reports?hashes=${hashes.join(",")}`).catch(() => ({})) : Promise.resolve({}),
      ]);
      return assembleSnapshot(raw, activity, reports);
    },

    async listEstatesFor(wallet) {
      const out: { estate: Base58; role: string; ownerName: string }[] = [];
      const conn = getConnection();
      const programId = pk(getIdl().address);
      const own = await findEstateOf(wallet);
      if (own) out.push({ estate: own, role: "owner", ownerName: (await getMeta(own))?.ownerName ?? "You" });
      // Beneficiary PDAs: [disc][estate 32][wallet 32]
      const bens = await conn.getProgramAccounts(programId, { filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(accountDiscriminator("Beneficiary")) } },
        { memcmp: { offset: 40, bytes: wallet } },
      ] }).catch(() => []);
      // Estate: [disc][owner][agent][usdt_mint][verifiers 3×32] → verifier i at 104 + 32i
      const verifierHits = await Promise.all([0, 1, 2].map((i) => conn.getProgramAccounts(programId, { filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(accountDiscriminator("Estate")) } },
        { memcmp: { offset: 104 + 32 * i, bytes: wallet } },
      ] }).catch(() => [])));
      for (const b of bens) {
        const estate = new PublicKey(b.account.data.subarray(8, 40)).toBase58();
        out.push({ estate, role: "beneficiary", ownerName: (await getMeta(estate))?.ownerName ?? "Family estate" });
      }
      for (const v of verifierHits.flat()) {
        const estate = v.pubkey.toBase58();
        out.push({ estate, role: "verifier", ownerName: (await getMeta(estate))?.ownerName ?? "Family estate" });
      }
      return out;
    },

    getFx: () => api<FxRate>("/api/fx"),

    willChat: (history: WillChatMessage[]) => post<{ reply: string; draft: WillDraft | null }>("/api/will-chat", { history }),

    async reviewDocument({ file, purpose, context }) {
      const signer = getActiveSigner();
      const estate = estatePda(chainCtx().programId, signer.address).toBase58();
      return (await review(file, purpose, estate, context, undefined, true)).report;
    },

    valueCar: (input) => post<CarValuation>("/api/valuation", input),

    async rankOffers(asset) {
      const raw = await mustFetch("Asset", asset);
      const r = await post<Parameters<typeof reviveRanking>[0]>("/api/rank-offers", { estate: key(raw, "estate"), asset });
      return reviveRanking(r);
    },

    // ----- Owner -----
    async createEstateFromWill(input) {
      const draft = willDraftSchema.parse(input); // the exact shape the server re-hashes
      const ctx = chainCtx();
      const owner = pk(getActiveSigner().address);
      const missing = [...draft.beneficiaries.filter((b) => !b.wallet).map((b) => b.label), ...draft.verifiers.filter((v) => !v.wallet).map((v) => v.name)];
      if (missing.length) throw new Error(`Add wallet addresses for: ${missing.join(", ")}.`);
      if (draft.verifiers.length !== 3) throw new Error("Exactly three verifiers are needed.");
      const { agentAddress } = await api<{ agentAddress: string | null }>("/api/agent");
      if (!agentAddress) throw new Error("The AI agent's wallet is not configured on the server.");

      const estate = estatePda(ctx.programId, owner);
      const willHash = await hashJson(draft);
      const waiting = Number.isFinite(DEMO_WAIT) && DEMO_WAIT >= 0 ? DEMO_WAIT : Math.round(draft.waitingPeriodDays * 86_400);
      const txs: TxResult[] = [];

      const exists = await fetchAccountRaw("Estate", estate.toBase58());
      const setup: TransactionInstruction[] = [];
      if (!exists) {
        setup.push(ix.createEstate(ctx, {
          owner, agent: pk(agentAddress), verifiers: draft.verifiers.map((v) => pk(v.wallet!)) as [PublicKey, PublicKey, PublicKey],
          deathThreshold: 2, claimThreshold: 1, hardshipThreshold: 2, waitingPeriodSecs: waiting,
        }));
      }
      setup.push(ix.setWill(ctx, owner, willHash, `heirloom:will:${willHash.slice(0, 16)}`));
      txs.push(await send(setup));

      const existingBens = new Set((exists ? (await fetchEstateRaw(estate.toBase58())).beneficiaries : []).map((b) => b.wallet));
      const benIxs = draft.beneficiaries.filter((b) => !existingBens.has(b.wallet!)).map((b) => ix.addBeneficiary(ctx, owner, pk(b.wallet!), b.label));
      for (const group of chunk(benIxs, 3)) txs.push(await send(group));

      let ruleId = exists ? num(exists, "rule_count") : 0;
      // Recurring rules pay a fixed payee, which must already be an approved payee (matched by name).
      const payees = exists ? (await fetchEstateRaw(estate.toBase58())).payees : [];
      const now = Math.floor(Date.now() / 1000);
      const ruleIxs = draft.rules.map((r) => {
        const ben = draft.beneficiaries.find((b) => b.label === r.beneficiaryLabel);
        if (!ben?.wallet) throw new Error(`Rule for unknown beneficiary "${r.beneficiaryLabel}".`);
        let recurring: Parameters<typeof ix.addRule>[2]["recurring"];
        if (r.recurring) {
          const payee = payees.find((p) => p.name.toLowerCase() === r.recurring!.payeeName.toLowerCase() && p.kind === r.allowedPayeeKind);
          if (payee) {
            const every = intervalSecs(r.recurring.every);
            recurring = { amount: toBase(r.recurring.amountUsdt), intervalSecs: every, firstDue: now + every, payeeWallet: pk(payee.wallet) };
          } else {
            // The payee's wallet is not known yet: the rule is created claim-based (same caps); add the payee and a
            // recurring rule later with addRule({ recurring }).
            console.warn(`Recurring payee "${r.recurring.payeeName}" is not an approved payee yet; rule created as claim-based.`);
          }
        }
        return ix.addRule(ctx, owner, {
          ruleId: ruleId++, beneficiaryWallet: pk(ben.wallet), category: r.category, allowedPayeeKind: r.allowedPayeeKind,
          maxPerClaim: toBase(r.maxPerClaimUsdt), lifetimeCap: toBase(r.lifetimeCapUsdt), validUntil: Math.floor(Date.parse(r.validUntil) / 1000),
          startsNow: r.startsNow, recurring,
        });
      });
      for (const group of chunk(ruleIxs, 2)) txs.push(await send(group));

      await post("/api/estate-meta", {
        estate: estate.toBase58(), ownerWallet: owner.toBase58(), ownerName: draft.ownerName,
        verifierNames: draft.verifiers.map((v) => v.name) as [string, string, string], assetTitles: {}, buyerNames: {}, draft,
      }).catch(() => undefined); // names are cosmetic; the estate itself is already on-chain
      return { estate: estate.toBase58(), txs };
    },

    async deposit(estate, amountUsdt) { const o = requireOwnerOf(estate); return send([ix.deposit(chainCtx(), o, toBase(amountUsdt))]); },
    async withdraw(estate, amountUsdt) { const o = requireOwnerOf(estate); return send([ix.withdraw(chainCtx(), o, toBase(amountUsdt))]); },
    async heartbeat(estate) { const o = requireOwnerOf(estate); return send([ix.heartbeat(chainCtx(), o)]); },
    async vetoDeath(estate) { const o = requireOwnerOf(estate); return send([ix.vetoDeath(chainCtx(), o)]); },

    async registerAsset(estate, input) {
      const o = requireOwnerOf(estate);
      const docHash = input.docFile ? await fileHash(input.docFile) : await sha256Hex(`heirloom:asset:${input.nftMint}:${input.title}`);
      const tx = await send([ix.registerAsset(chainCtx(), o, {
        nftMint: pk(input.nftMint), floorPrice: toBase(input.floorUsdt), hardshipFloor: toBase(input.hardshipFloorUsdt),
        askingPrice: toBase(input.askingUsdt), proceedsTo: pk(input.proceedsTo), docHashHex: docHash,
      })]);
      const meta = await getMeta(estate);
      if (meta) await post("/api/estate-meta", { ...meta, assetTitles: { ...meta.assetTitles, [input.nftMint]: input.title } }).catch(() => undefined);
      return tx;
    },

    async addPayee(estate, input) {
      const o = requireOwnerOf(estate);
      return send([ix.addPayee(chainCtx(), o, pk(input.wallet), input.kind, input.name)]);
    },

    async addRule(estate, input) {
      const o = requireOwnerOf(estate);
      const raw = await mustFetch("Estate", estate);
      return send([ix.addRule(chainCtx(), o, {
        ruleId: num(raw, "rule_count"), beneficiaryWallet: pk(input.beneficiary), category: input.category, allowedPayeeKind: input.allowedPayeeKind,
        maxPerClaim: toBase(input.maxPerClaimUsdt), lifetimeCap: toBase(input.lifetimeCapUsdt), validUntil: input.validUntil,
        startsNow: input.startsNow,
        recurring: input.recurring && {
          amount: toBase(input.recurring.amountUsdt), intervalSecs: input.recurring.intervalSecs,
          firstDue: input.recurring.firstDue, payeeWallet: pk(input.recurring.payee),
        },
      })]);
    },

    async ownerApproveClaim(estate, claim) {
      const o = requireOwnerOf(estate);
      const raw = await mustFetch("Claim", claim);
      return send([ix.ownerApproveClaim(chainCtx(), o, pk(claim), pk(key(raw, "rule")))]);
    },

    async executeScheduled(estate, rule) {
      const raw = await mustFetch("Rule", rule);
      const fixed = key(raw, "fixed_payee");
      return send([ix.executeScheduled(chainCtx(), { estate: pk(estate), payer: pk(getActiveSigner().address), rule: pk(rule), payeeWallet: pk(fixed) })]);
    },

    // ----- Family -----
    async submitDeathClaim(estate, certificate) {
      const me = pk(getActiveSigner().address);
      const h = await fileHash(certificate);
      const tx = await send([ix.submitDeathClaim(chainCtx(), pk(estate), me, h)]);
      const meta = await getMeta(estate);
      const r = await review(certificate, "death", estate, `Estate owner's name: ${meta?.ownerName ?? "unknown"}.`);
      return { tx, report: r.report };
    },

    async submitClaim(estate, input) {
      const ctx = chainCtx();
      const me = pk(getActiveSigner().address);
      const rule = await mustFetch("Rule", input.rule);
      const ruleId = num(rule, "id");
      const claimId = num(rule, "claim_count");
      const h = await fileHash(input.evidence);
      const tx = await send([ix.submitClaim(ctx, {
        estate: pk(estate), signer: me, ruleId, claimId, payeeWallet: pk(input.payee), amount: toBase(input.amountUsdt), evidenceHashHex: h,
      })]);
      const claim = claimPda(ctx.programId, input.rule, claimId).toBase58();
      const r = await review(input.evidence, "claim", estate, `Claim for ${input.amountUsdt} USD₮ under rule #${ruleId}, payee wallet ${input.payee}.`, claim);
      return { tx, claim, report: r.report };
    },

    async submitHardship(estate, input) {
      const ctx = chainCtx();
      const me = pk(getActiveSigner().address);
      const h = await fileHash(input.evidence);
      const tx = await send([ix.submitHardship(ctx, pk(estate), pk(input.asset), me, h)]);
      const hardship = hardshipPda(ctx.programId, input.asset, me).toBase58();
      const r = await review(input.evidence, "hardship", estate, "Hardship request to sell the car below the floor price.", hardship);
      return { tx, report: r.report };
    },

    // ----- Verifiers -----
    async attestDeath(estate) { return send([ix.attestDeath(pk(estate), pk(getActiveSigner().address))]); },

    async approveClaim(estate, claim) {
      const raw = await mustFetch("Claim", claim);
      return send([ix.approveClaim(pk(estate), pk(getActiveSigner().address), pk(claim), pk(key(raw, "rule")))]);
    },

    async approveHardship(estate, hardship) {
      const raw = await mustFetch("Hardship", hardship);
      return send([ix.approveHardship(pk(estate), pk(getActiveSigner().address), pk(key(raw, "asset")), pk(hardship))]);
    },

    // ----- Anyone -----
    async finalizeUnlock(estate) { return send([ix.finalizeUnlock(pk(estate), pk(getActiveSigner().address))]); },

    async executeClaim(estate, claim) {
      const raw = await mustFetch("Claim", claim);
      return send([ix.executeClaim(chainCtx(), {
        estate: pk(estate), payer: pk(getActiveSigner().address), rule: pk(key(raw, "rule")), claim: pk(claim), payeeWallet: pk(key(raw, "payee")),
      })]);
    },

    // ----- Car sale -----
    listAsset: (estate, asset, durationSecs) => post<TxResult>("/api/list-asset", { estate, asset, durationSecs }),

    async placeOffer(estate, asset, amountUsdt) {
      return send([ix.placeOffer(chainCtx(), pk(estate), pk(asset), pk(getActiveSigner().address), toBase(amountUsdt))]);
    },

    async withdrawOffer(estate, asset) {
      const me = getActiveSigner().address;
      if (!(await fetchAccountRaw("Offer", offerPda(chainCtx().programId, asset, me).toBase58()))) throw new Error("You have no open offer on this car.");
      return send([ix.withdrawOffer(chainCtx(), pk(estate), pk(asset), pk(me))]);
    },

    async acceptBestOffer(estate, asset) {
      const res = await fetch("/api/accept-offer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ estate, asset }) });
      const data = (await res.json()) as { tx: TxResult | null; ranking: Parameters<typeof reviveRanking>[0]; error?: string };
      if (!res.ok || !data.tx) throw new Error(data.error ?? `Could not accept an offer (${res.status}).`);
      return { tx: data.tx, ranking: reviveRanking(data.ranking) };
    },
  };
}
