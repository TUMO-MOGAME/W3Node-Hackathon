/**
 * HeirloomService on Solana devnet. Writes: build instructions → unsigned base64 tx → the active Tether WDK
 * wallet signs and sends (wallet/signer.ts, kept in sync by <WalletProvider>) → confirm. Reads: RPC + decoders.
 * Agent actions (reviews, listing, accepting offers, valuation, chat) go through our API routes, where the
 * agent's own WDK wallet signs only review_* / list_asset / accept_offer.
 */
import { PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction } from "@solana/spl-token";
import type { HeirloomService, EstateSnapshot, TxResult } from "./types";
import type {
  AgentReport, Base58, CarValuation, FxRate, OfferRanking, PaymentReceipt, PaymentReview, SavedRecipient, WillChatMessage, WillDraft,
} from "../types";
import { chainCtx } from "../chain/client";
import { chainConfig } from "../chain/config";
import * as ix from "../chain/instructions";
import { ata, claimPda, estatePda, offerPda, hardshipPda } from "../chain/pda";
import { base64ToBytes, bytesToBase64, ChainTxError, getConnection } from "../chain/tx";
import { fetchAccountRaw, fetchActivity, fetchEstateRaw, findEstateOf } from "../chain/reads";
import { assembleSnapshot } from "../chain/snapshot";
import { key, num, type Raw } from "../chain/decoders";
import { accountDiscriminator, getIdl } from "../chain/idl";
import { getActiveSigner } from "../wallet/signer";
import { defaultReceiptStore, newPaymentId, openReceipts, recheck, runPayment, waitForFinal, type ChainOps, type StoredPayment } from "../wallet/payments";
import { readOnly } from "../wallet/wdk";
import { loadWallets } from "../wallet/store";
import { explorerTx, toBase } from "../format";
import { hashJson, sha256Hex } from "../agent/hash";
import { intervalSecs, willDraftSchema } from "../agent/schemas";
import type { EstateMeta } from "../db";
import bs58 from "bs58";
import { legacyApi, type LegacySigner } from "../legacy/client";

// ---------- legacy voice: requests signed by the acting WDK wallet; the server checks the on-chain role ----------
function legacySigner(estate: Base58): LegacySigner {
  const s = getActiveSigner();
  return { estate, wallet: s.address, sign: (m) => s.signMessage(m) };
}

// ---------- small helpers ----------
const pk = (a: string) => new PublicKey(a);

// ---------- pay-once pipeline (wallet/payments.ts) ----------
const receipts = defaultReceiptStore();

function chainOps(): ChainOps {
  const conn = getConnection();
  return {
    status: async (sig) => (await conn.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0],
    blockHeight: () => conn.getBlockHeight("confirmed"),
    broadcast: async (wire) => { await conn.sendRawTransaction(base64ToBytes(wire), { maxRetries: 3 }); },
  };
}

/** Builds the tx, WDK signs it (sign-only), signature persisted, then broadcast; returns the receipt. */
async function pay(id: string, ixs: TransactionInstruction[], meta: Pick<StoredPayment, "kind" | "to" | "toLabel" | "amount">) {
  const signer = getActiveSigner();
  return runPayment(receipts, chainOps(), id, async () => {
    const conn = getConnection();
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: pk(signer.address), blockhash, lastValidBlockHeight }).add(...ixs);
    const b64 = bytesToBase64(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
    return { ...(await signer.signOnly(b64)), lastValidBlockHeight };
  }, meta);
}

/** Every user-initiated program tx goes through the same pay-once pipeline and waits for confirmation. */
async function send(ixs: TransactionInstruction[], meta: Pick<StoredPayment, "kind" | "to" | "toLabel" | "amount"> = { kind: "program" }): Promise<TxResult> {
  const id = newPaymentId();
  const first = await pay(id, ixs, meta);
  const r = first.status === "failed" ? first : await waitForFinal(receipts, chainOps(), id, 60_000, 800);
  if (!r || r.status === "failed") throw new ChainTxError(r?.signature ?? "", r?.error ?? "Transaction failed.");
  if (!r.signature) throw new Error("Transaction was not signed.");
  return { signature: r.signature, explorerUrl: explorerTx(r.signature) };
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

    async deposit(estate, amountUsdt) { const o = requireOwnerOf(estate); return send([ix.deposit(chainCtx(), o, toBase(amountUsdt))], { kind: "vault-deposit", to: estate, toLabel: "Estate vault", amount: toBase(amountUsdt).toString() }); },
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
      return send([ix.executeScheduled(chainCtx(), { estate: pk(estate), payer: pk(getActiveSigner().address), rule: pk(rule), payeeWallet: pk(fixed) })],
        { kind: "scheduled", to: fixed, toLabel: "Scheduled payee", amount: String(raw.recurring_amount ?? "0") });
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
      })], { kind: "claim-payout", to: key(raw, "payee"), toLabel: "Approved institution", amount: String(raw.amount ?? "0") });
    },

    // ----- P2P USD₮ (Tether track flow: review → approve → WDK sign → pending → confirmed) -----
    async reviewSend({ to, toLabel, amountUsdt }): Promise<PaymentReview> {
      const from = getActiveSigner().address;
      let toKey: PublicKey;
      try { toKey = pk(to); } catch { throw new Error("That is not a valid Solana address."); }
      if (to === from) throw new Error("You cannot send to your own wallet.");
      if (!(amountUsdt > 0)) throw new Error("Enter an amount above zero.");
      const amount = toBase(amountUsdt);
      const conn = getConnection();
      const mint = chainCtx().usdtMint;
      const warnings: string[] = [];

      // Token check: the configured USD₮ mint must exist on this cluster with 6 decimals.
      const mintInfo = await conn.getParsedAccountInfo(mint, "confirmed");
      const parsed = mintInfo.value?.data as { parsed?: { type?: string; info?: { decimals?: number } } } | undefined;
      const verified = parsed?.parsed?.type === "mint" && parsed.parsed.info?.decimals === 6;
      if (!verified) warnings.push("The USD₮ token could not be verified on this network. Do not send.");
      if (!PublicKey.isOnCurve(toKey.toBytes())) warnings.push("This address is a program account, not a person's wallet. Check it carefully.");

      // Balances + fee quote via Tether WDK (read-only account: no keys needed).
      const ro = await readOnly(from, chainConfig.rpcUrl);
      const [usdt, lamports, quote, recipientAta] = await Promise.all([
        ro.getTokenBalance(mint.toBase58()), ro.getBalance(),
        ro.quoteTransfer({ token: mint.toBase58(), recipient: to, amount }).catch(() => null),
        conn.getAccountInfo(ata(mint, toKey), "confirmed"),
      ]);
      const rent = recipientAta ? 0 : 2_039_280; // rent for a new token account, paid by the sender
      if (!recipientAta) warnings.push("The recipient has no USD₮ account yet: it will be created (about 0.002 SOL, paid by you).");
      const feeLamports = Number(quote?.fee ?? 5000n) + rent;
      if (!quote) warnings.push("Fee estimate unavailable; using the standard network fee.");
      const sol = Number(lamports) / 1e9;
      const sufficient = usdt >= amount && Number(lamports) >= feeLamports;
      if (usdt < amount) warnings.push("Not enough USD₮ in this wallet.");
      if (Number(lamports) < feeLamports) warnings.push("Not enough SOL to pay the network fee.");

      const review: PaymentReview = {
        id: newPaymentId(), kind: "p2p", from, to, toLabel, amount,
        token: { symbol: "USD₮", mint: mint.toBase58(), verified },
        network: { name: `Solana ${chainConfig.cluster}`, cluster: chainConfig.cluster === "mainnet-beta" ? "mainnet-beta" : chainConfig.cluster === "localnet" ? "localnet" : "devnet" },
        fee: { lamports: feeLamports, sol: feeLamports / 1e9, payer: from, sponsored: false },
        balances: { usdt, sol, sufficient },
        warnings,
      };
      receipts.put({ id: review.id, status: "awaiting-approval", kind: "p2p", to, toLabel, amount: amount.toString(), updatedAt: Date.now() });
      return review;
    },

    async confirmSend(review) {
      if (!review.token.verified) throw new Error("The USD₮ token is not verified on this network; payment blocked.");
      if (review.token.mint !== chainCtx().usdtMint.toBase58()) throw new Error("Token mismatch: this is not the configured USD₮ mint.");
      if (review.from !== getActiveSigner().address) throw new Error("Switch back to the wallet that reviewed this payment.");
      const mint = chainCtx().usdtMint;
      const from = pk(review.from), to = pk(review.to);
      const ixs = [
        createAssociatedTokenAccountIdempotentInstruction(from, ata(mint, to), to, mint),
        createTransferCheckedInstruction(ata(mint, from), mint, ata(mint, to), from, review.amount, 6),
      ];
      return pay(review.id, ixs, { kind: "p2p", to: review.to, toLabel: review.toLabel, amount: review.amount.toString() });
    },

    getReceipt: (id): Promise<PaymentReceipt | null> => recheck(receipts, chainOps(), id),

    async listPendingReceipts() {
      const out: PaymentReceipt[] = [];
      for (const r of openReceipts(receipts)) { const n = await recheck(receipts, chainOps(), r.id).catch(() => r); if (n) out.push(n); }
      return out;
    },

    async savedRecipients(): Promise<SavedRecipient[]> {
      const me = getActiveSigner().address;
      const seen = new Map<string, SavedRecipient>();
      for (const w of loadWallets()) if (w.address !== me) seen.set(w.address, { label: w.label, address: w.address, relationship: w.role });
      for (const r of receipts.list()) {
        if (r.kind === "p2p" && r.to && r.toLabel && !seen.has(r.to) && r.to !== me) seen.set(r.to, { label: r.toLabel, address: r.to });
      }
      return [...seen.values()];
    },

    // ----- Car sale -----
    listAsset: (estate, asset, durationSecs) => post<TxResult>("/api/list-asset", { estate, asset, durationSecs }),

    async placeOffer(estate, asset, amountUsdt) {
      return send([ix.placeOffer(chainCtx(), pk(estate), pk(asset), pk(getActiveSigner().address), toBase(amountUsdt))],
        { kind: "offer", to: asset, toLabel: "Offer escrow", amount: toBase(amountUsdt).toString() });
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

    legacyStatus: (estate) => legacyApi.status(legacySigner(estate)),
    createLegacyVoice: (estate, input) => legacyApi.createVoice(legacySigner(estate), input),
    deleteLegacyVoice: (estate) => legacyApi.deleteVoice(legacySigner(estate)),
    saveLegacyBook: (estate, book) => legacyApi.saveBook(legacySigner(estate), book),
    deleteLegacyBook: (estate) => legacyApi.deleteBook(legacySigner(estate)),
    setLegacyOptIn: (estate, on) => legacyApi.optIn(legacySigner(estate), on),
    legacyChat: (estate, history, opts) => legacyApi.chat(legacySigner(estate), history, opts?.previewChildId),
    legacySpeak: (estate, input, voice) => legacyApi.speak(legacySigner(estate), input, voice),
    async legacyCall(estate, opts) {
      try { return await legacyApi.session(legacySigner(estate), opts?.previewChildId); }
      catch (e) { if ((e as { status?: number }).status === 503) return null; throw e; }
    },
  };
}
