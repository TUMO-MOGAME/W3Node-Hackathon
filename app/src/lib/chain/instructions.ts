/**
 * Instruction builders for every instruction in docs/program-spec.md.
 *
 * Accounts are resolved from the IDL by name: each builder supplies the addresses it knows under a few
 * likely names (e.g. the owner's USD₮ account as owner_token / owner_ata / owner_usdt), and the IDL's
 * own account list decides order, signer and writable flags. Args are passed positionally in spec
 * order and mapped onto the IDL's arg names. This keeps the client correct even if the contract
 * author picks slightly different account/arg names, and fails loudly (naming the missing account)
 * if something is genuinely missing.
 */
import { BN } from "@anchor-lang/core";
import { PublicKey, TransactionInstruction, type AccountMeta } from "@solana/web3.js";
import type { Category, PayeeKind } from "../types";
import { enumValue, findInstruction, getCoder, getIdl, norm } from "./idl";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID,
  assetPda, ata, beneficiaryPda, claimPda, estatePda, hardshipPda, nftEscrowAta, offerEscrowAta, offerPda,
  payeePda, rulePda, vaultAta,
} from "./pda";

const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");

/** name (any case/underscore style) → address. Several names may map to the same address. */
export type KnownAccounts = Record<string, PublicKey>;

function programAccounts(): KnownAccounts {
  return {
    system_program: SYSTEM_PROGRAM_ID,
    token_program: TOKEN_PROGRAM_ID,
    associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: RENT_SYSVAR,
  };
}

type IdlAccountItem = ReturnType<typeof findInstruction>["accounts"][number];
interface FlatAccount { name: string; writable: boolean; signer: boolean; optional: boolean; address?: string }

function flatten(items: IdlAccountItem[]): FlatAccount[] {
  const out: FlatAccount[] = [];
  for (const it of items) {
    if ("accounts" in it) out.push(...flatten(it.accounts));
    else out.push({ name: it.name, writable: !!it.writable, signer: !!it.signer, optional: !!it.optional, address: it.address });
  }
  return out;
}

export function resolveAccountMetas(ixName: string, known: KnownAccounts, programId: PublicKey): AccountMeta[] {
  const ix = findInstruction(ixName);
  const lookup = new Map<string, PublicKey>();
  for (const [k, v] of Object.entries({ ...programAccounts(), ...known })) lookup.set(norm(k), v);
  const missing: string[] = [];
  const metas = flatten(ix.accounts).map((a): AccountMeta => {
    const pubkey = a.address ? new PublicKey(a.address) : lookup.get(norm(a.name));
    if (!pubkey) {
      if (a.optional) return { pubkey: programId, isSigner: false, isWritable: false }; // Anchor's "None"
      missing.push(a.name);
      return { pubkey: PublicKey.default, isSigner: false, isWritable: false };
    }
    return { pubkey, isSigner: a.signer, isWritable: a.writable };
  });
  if (missing.length) {
    throw new Error(`Cannot build ${ixName}: no address for account(s) ${missing.join(", ")}. Update chain/instructions.ts aliases to match the IDL.`);
  }
  return metas;
}

export function buildIx(ixName: string, positionalArgs: unknown[], known: KnownAccounts): TransactionInstruction {
  const idl = getIdl();
  const programId = new PublicKey(idl.address);
  const ix = findInstruction(ixName);
  if (ix.args.length !== positionalArgs.length) {
    throw new Error(`${ixName}: IDL expects ${ix.args.length} args, client passed ${positionalArgs.length}. IDL and spec disagree.`);
  }
  const args: Record<string, unknown> = {};
  ix.args.forEach((a, i) => { args[a.name] = positionalArgs[i]; });
  const data = getCoder().instruction.encode(ix.name, args);
  return new TransactionInstruction({ programId, keys: resolveAccountMetas(ixName, known, programId), data });
}

// ---------- value helpers ----------
export const u64 = (v: bigint | number) => new BN(v.toString());
export const i64 = (v: number) => new BN(Math.trunc(v).toString());
export function hash32(hex: string): number[] {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Expected a 64-char hex sha256 hash");
  const out: number[] = [];
  for (let i = 0; i < 64; i += 2) out.push(Number.parseInt(hex.slice(i, i + 2), 16));
  return out;
}
const cat = (c: Category) => enumValue("Category", c);
const kind = (k: PayeeKind) => enumValue("PayeeKind", k);

// ---------- context ----------
export interface Ctx { programId: PublicKey; usdtMint: PublicKey }

function estateAccounts(ctx: Ctx, owner: PublicKey) {
  const estate = estatePda(ctx.programId, owner);
  const vault = vaultAta(ctx.usdtMint, estate);
  return { estate, vault, estate_vault: vault, vault_ata: vault, usdt_mint: ctx.usdtMint, mint: ctx.usdtMint };
}

// ---------- builders (spec §Instructions, numbered as in the spec) ----------

/** 1 */
export function createEstate(ctx: Ctx, p: {
  owner: PublicKey; agent: PublicKey; verifiers: [PublicKey, PublicKey, PublicKey];
  deathThreshold: number; claimThreshold: number; hardshipThreshold: number; waitingPeriodSecs: number;
}) {
  return buildIx("create_estate",
    [p.agent, p.verifiers, p.deathThreshold, p.claimThreshold, p.hardshipThreshold, i64(p.waitingPeriodSecs)],
    { owner: p.owner, ...estateAccounts(ctx, p.owner) });
}

/** 2 */
export function setWill(ctx: Ctx, owner: PublicKey, willHashHex: string, willUri: string) {
  return buildIx("set_will", [hash32(willHashHex), willUri], { owner, ...estateAccounts(ctx, owner) });
}

/** 3 */
export function addBeneficiary(ctx: Ctx, owner: PublicKey, wallet: PublicKey, label: string) {
  const { estate } = estateAccounts(ctx, owner);
  return buildIx("add_beneficiary", [label],
    { owner, estate, wallet, beneficiary_wallet: wallet, beneficiary: beneficiaryPda(ctx.programId, estate, wallet) });
}

/** 4 */
export function addPayee(ctx: Ctx, owner: PublicKey, wallet: PublicKey, k: PayeeKind, name: string) {
  const { estate } = estateAccounts(ctx, owner);
  return buildIx("add_payee", [kind(k), name],
    { owner, estate, wallet, payee_wallet: wallet, payee: payeePda(ctx.programId, estate, wallet) });
}

/**
 * 5. `ruleId` must be the estate's current rule_count.
 * Living plans: `startsNow` lets the rule pay while the owner is alive; `recurring` makes it a scheduled payment
 * (fixed amount to a fixed payee every interval, first at `firstDue`). Args are passed in spec order
 * (…, valid_until, starts_now, recurring_amount, interval_secs, first_due). If the deployed IDL predates living
 * plans (5 args), plain rules still work and living-plan options fail with a clear error.
 */
export function addRule(ctx: Ctx, owner: PublicKey, p: {
  ruleId: number; beneficiaryWallet: PublicKey; category: Category; allowedPayeeKind: PayeeKind;
  maxPerClaim: bigint; lifetimeCap: bigint; validUntil: number;
  startsNow?: boolean; recurring?: { amount: bigint; intervalSecs: number; firstDue: number; payeeWallet: PublicKey };
}) {
  const { estate } = estateAccounts(ctx, owner);
  const base = [cat(p.category), kind(p.allowedPayeeKind), u64(p.maxPerClaim), u64(p.lifetimeCap), i64(p.validUntil)];
  const living = [!!p.startsNow, u64(p.recurring?.amount ?? 0n), i64(p.recurring?.intervalSecs ?? 0), i64(p.recurring?.firstDue ?? 0)];
  const idlArgs = findInstruction("add_rule").args.length;
  if (idlArgs === base.length && (p.startsNow || p.recurring)) {
    throw new Error("The deployed program does not support living plans yet (add_rule has no starts_now/recurring args).");
  }
  const payee = p.recurring ? payeePda(ctx.programId, estate, p.recurring.payeeWallet) : undefined;
  return buildIx("add_rule", idlArgs === base.length ? base : [...base, ...living], {
    owner, estate, rule: rulePda(ctx.programId, estate, p.ruleId),
    beneficiary: beneficiaryPda(ctx.programId, estate, p.beneficiaryWallet), beneficiary_wallet: p.beneficiaryWallet,
    ...(payee && p.recurring ? { payee, fixed_payee: payee, payee_account: payee, payee_wallet: p.recurring.payeeWallet } : {}),
  });
}

function ownerTokenAccounts(ctx: Ctx, owner: PublicKey) {
  const t = ata(ctx.usdtMint, owner);
  return { owner_token: t, owner_ata: t, owner_usdt: t, owner_token_account: t, owner_usdt_ata: t };
}

/** 6 */
export function deposit(ctx: Ctx, owner: PublicKey, amount: bigint) {
  return buildIx("deposit", [u64(amount)], { owner, ...estateAccounts(ctx, owner), ...ownerTokenAccounts(ctx, owner) });
}

/** 7 */
export function withdraw(ctx: Ctx, owner: PublicKey, amount: bigint) {
  return buildIx("withdraw", [u64(amount)], { owner, ...estateAccounts(ctx, owner), ...ownerTokenAccounts(ctx, owner) });
}

/** 8 */
export function heartbeat(ctx: Ctx, owner: PublicKey) {
  return buildIx("heartbeat", [], { owner, ...estateAccounts(ctx, owner) });
}

/** 9 */
export function registerAsset(ctx: Ctx, owner: PublicKey, p: {
  nftMint: PublicKey; floorPrice: bigint; hardshipFloor: bigint; askingPrice: bigint; proceedsTo: PublicKey; docHashHex: string;
}) {
  const { estate } = estateAccounts(ctx, owner);
  const ownerNft = ata(p.nftMint, owner);
  const escrow = nftEscrowAta(p.nftMint, estate);
  return buildIx("register_asset",
    [u64(p.floorPrice), u64(p.hardshipFloor), u64(p.askingPrice), p.proceedsTo, hash32(p.docHashHex)],
    {
      owner, estate, nft_mint: p.nftMint, asset: assetPda(ctx.programId, estate, p.nftMint),
      owner_nft: ownerNft, owner_nft_ata: ownerNft, owner_nft_account: ownerNft,
      nft_escrow: escrow, escrow_nft: escrow, nft_vault: escrow,
    });
}

/**
 * Accounts for a beneficiary signer acting on an estate. In these instructions the IDL names the signing
 * wallet `beneficiary` and the Beneficiary PDA `beneficiary_account` (unlike add_rule, where `beneficiary`
 * is the PDA), so both spellings are mapped here.
 */
function beneficiarySigner(ctx: Ctx, estate: PublicKey, signer: PublicKey) {
  const pda = beneficiaryPda(ctx.programId, estate, signer);
  return {
    beneficiary: signer, signer, beneficiary_wallet: signer, claimant: signer, submitter: signer, authority: signer,
    beneficiary_account: pda, beneficiary_pda: pda, estate,
  };
}

/** 10 */
export function submitDeathClaim(ctx: Ctx, estate: PublicKey, signer: PublicKey, certHashHex: string) {
  return buildIx("submit_death_claim", [hash32(certHashHex)], beneficiarySigner(ctx, estate, signer));
}

/** 11 (agent) */
export function reviewDeath(estate: PublicKey, agent: PublicKey, approve: boolean, reportHashHex: string) {
  return buildIx("review_death", [approve, hash32(reportHashHex)], { agent, estate });
}

/** 12 */
export function attestDeath(estate: PublicKey, verifier: PublicKey) {
  return buildIx("attest_death", [], { verifier, estate });
}

/** 13 */
export function vetoDeath(ctx: Ctx, owner: PublicKey) {
  return buildIx("veto_death", [], { owner, ...estateAccounts(ctx, owner) });
}

/** 14 */
export function finalizeUnlock(estate: PublicKey, signer: PublicKey) {
  return buildIx("finalize_unlock", [], { signer, payer: signer, caller: signer, authority: signer, estate });
}

/** 15. `claimId` must be the rule's current claim_count. */
export function submitClaim(ctx: Ctx, p: {
  estate: PublicKey; signer: PublicKey; ruleId: number; claimId: number; payeeWallet: PublicKey; amount: bigint; evidenceHashHex: string;
}) {
  const rule = rulePda(ctx.programId, p.estate, p.ruleId);
  return buildIx("submit_claim", [u64(p.amount), hash32(p.evidenceHashHex)], {
    ...beneficiarySigner(ctx, p.estate, p.signer), rule,
    payee: payeePda(ctx.programId, p.estate, p.payeeWallet), payee_wallet: p.payeeWallet,
    claim: claimPda(ctx.programId, rule, p.claimId),
  });
}

/** 16 (agent) */
export function reviewClaim(estate: PublicKey, agent: PublicKey, claim: PublicKey, rule: PublicKey, approve: boolean, reportHashHex: string) {
  return buildIx("review_claim", [approve, hash32(reportHashHex)], { agent, estate, claim, rule });
}

/** 17 */
export function approveClaim(estate: PublicKey, verifier: PublicKey, claim: PublicKey, rule: PublicKey) {
  return buildIx("approve_claim", [], { verifier, estate, claim, rule });
}

/** 18 */
export function executeClaim(ctx: Ctx, p: { estate: PublicKey; payer: PublicKey; rule: PublicKey; claim: PublicKey; payeeWallet: PublicKey }) {
  const payeeToken = ata(ctx.usdtMint, p.payeeWallet);
  const vault = vaultAta(ctx.usdtMint, p.estate);
  return buildIx("execute_claim", [], {
    payer: p.payer, signer: p.payer, caller: p.payer, authority: p.payer,
    estate: p.estate, rule: p.rule, claim: p.claim,
    payee: payeePda(ctx.programId, p.estate, p.payeeWallet), payee_wallet: p.payeeWallet,
    payee_token: payeeToken, payee_ata: payeeToken, payee_usdt: payeeToken, payee_token_account: payeeToken,
    usdt_mint: ctx.usdtMint, mint: ctx.usdtMint, vault, estate_vault: vault, vault_ata: vault,
  });
}

/** Living plan: the owner approves a claim on a starts_now rule while alive. */
export function ownerApproveClaim(ctx: Ctx, owner: PublicKey, claim: PublicKey, rule: PublicKey) {
  return buildIx("owner_approve_claim", [], { owner, ...estateAccounts(ctx, owner), claim, rule });
}

/** Scheduled payment: anyone (agent scheduler, UI button) pays a due recurring rule to its fixed payee. */
export function executeScheduled(ctx: Ctx, p: { estate: PublicKey; payer: PublicKey; rule: PublicKey; payeeWallet: PublicKey }) {
  const payeeToken = ata(ctx.usdtMint, p.payeeWallet);
  const vault = vaultAta(ctx.usdtMint, p.estate);
  const payee = payeePda(ctx.programId, p.estate, p.payeeWallet);
  return buildIx("execute_scheduled", [], {
    payer: p.payer, signer: p.payer, caller: p.payer, authority: p.payer, cranker: p.payer,
    estate: p.estate, rule: p.rule, payee, payee_account: payee, fixed_payee: p.payeeWallet, payee_wallet: p.payeeWallet,
    payee_token: payeeToken, payee_ata: payeeToken, payee_usdt: payeeToken, payee_token_account: payeeToken,
    usdt_mint: ctx.usdtMint, mint: ctx.usdtMint, vault, estate_vault: vault, vault_ata: vault,
  });
}

/** 19 (agent or verifier) */
export function listAsset(estate: PublicKey, authority: PublicKey, asset: PublicKey, durationSecs: number) {
  return buildIx("list_asset", [i64(durationSecs)], { authority, signer: authority, agent: authority, estate, asset });
}

function offerAccounts(ctx: Ctx, estate: PublicKey, asset: PublicKey, buyer: PublicKey) {
  const offer = offerPda(ctx.programId, asset, buyer);
  const escrow = offerEscrowAta(ctx.usdtMint, offer);
  const buyerToken = ata(ctx.usdtMint, buyer);
  return {
    buyer, estate, asset, offer, usdt_mint: ctx.usdtMint, mint: ctx.usdtMint,
    offer_escrow: escrow, escrow, offer_vault: escrow,
    buyer_token: buyerToken, buyer_ata: buyerToken, buyer_usdt: buyerToken, buyer_token_account: buyerToken,
  };
}

/** 20 */
export function placeOffer(ctx: Ctx, estate: PublicKey, asset: PublicKey, buyer: PublicKey, amount: bigint) {
  return buildIx("place_offer", [u64(amount)], offerAccounts(ctx, estate, asset, buyer));
}

/** 21 */
export function withdrawOffer(ctx: Ctx, estate: PublicKey, asset: PublicKey, buyer: PublicKey) {
  return buildIx("withdraw_offer", [], offerAccounts(ctx, estate, asset, buyer));
}

/** 22 */
export function submitHardship(ctx: Ctx, estate: PublicKey, asset: PublicKey, signer: PublicKey, evidenceHashHex: string) {
  return buildIx("submit_hardship", [hash32(evidenceHashHex)], {
    ...beneficiarySigner(ctx, estate, signer), asset, hardship: hardshipPda(ctx.programId, asset, signer),
  });
}

/** 23 (agent) */
export function reviewHardship(estate: PublicKey, agent: PublicKey, asset: PublicKey, hardship: PublicKey, approve: boolean, reportHashHex: string) {
  return buildIx("review_hardship", [approve, hash32(reportHashHex)], { agent, estate, asset, hardship });
}

/** 24 */
export function approveHardship(estate: PublicKey, verifier: PublicKey, asset: PublicKey, hardship: PublicKey) {
  return buildIx("approve_hardship", [], { verifier, estate, asset, hardship });
}

/** 25 (agent). `recipient` = hardship beneficiary if set, else asset.proceeds_to. */
export function acceptOffer(ctx: Ctx, p: {
  estate: PublicKey; agent: PublicKey; asset: PublicKey; nftMint: PublicKey; buyer: PublicKey; recipient: PublicKey;
}) {
  const o = offerAccounts(ctx, p.estate, p.asset, p.buyer);
  const recipientToken = ata(ctx.usdtMint, p.recipient);
  const escrowNft = nftEscrowAta(p.nftMint, p.estate);
  const buyerNft = ata(p.nftMint, p.buyer);
  return buildIx("accept_offer", [], {
    ...o, agent: p.agent, nft_mint: p.nftMint,
    recipient: p.recipient, proceeds_to: p.recipient, recipient_wallet: p.recipient,
    recipient_token: recipientToken, recipient_ata: recipientToken, recipient_usdt: recipientToken, proceeds_token: recipientToken,
    nft_escrow: escrowNft, escrow_nft: escrowNft, nft_vault: escrowNft,
    buyer_nft: buyerNft, buyer_nft_ata: buyerNft, buyer_nft_account: buyerNft,
  });
}
