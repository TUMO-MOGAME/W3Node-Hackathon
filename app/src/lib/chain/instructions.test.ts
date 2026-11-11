/**
 * Builds every instruction against the real IDL (src/lib/chain/idl/heirloom.json): catches drift between
 * the contract's account/arg names and our builders before it reaches devnet.
 */
import { describe, expect, it } from "vitest";
import { BN } from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as ix from "./instructions";
import { findInstruction, getCoder, getIdl } from "./idl";
import { assetPda, claimPda, estatePda, hardshipPda, offerPda, rulePda } from "./pda";
import { decodeEstate, type Raw } from "./decoders";

const k = () => Keypair.generate().publicKey;
const programId = new PublicKey(getIdl().address);
const ctx: ix.Ctx = { programId, usdtMint: k() };
const owner = k(), agent = k(), ben = k(), payee = k(), buyer = k(), nft = k();
const v = [k(), k(), k()] as [PublicKey, PublicKey, PublicKey];
const estate = estatePda(programId, owner);
const asset = assetPda(programId, estate, nft);
const rule0 = rulePda(programId, estate, 0);
const H = "ab".repeat(32);

const built: Record<string, () => ReturnType<typeof ix.buildIx>> = {
  create_estate: () => ix.createEstate(ctx, { owner, agent, verifiers: v, deathThreshold: 2, claimThreshold: 1, hardshipThreshold: 2, waitingPeriodSecs: 120 }),
  set_will: () => ix.setWill(ctx, owner, H, "heirloom:will:x"),
  add_beneficiary: () => ix.addBeneficiary(ctx, owner, ben, "Lerato"),
  add_payee: () => ix.addPayee(ctx, owner, payee, "University", "UCT"),
  add_rule: () => ix.addRule(ctx, owner, { ruleId: 0, beneficiaryWallet: ben, category: "Tuition", allowedPayeeKind: "University", maxPerClaim: 1n, lifetimeCap: 2n, validUntil: 2e9 }),
  deposit: () => ix.deposit(ctx, owner, 5n),
  withdraw: () => ix.withdraw(ctx, owner, 5n),
  heartbeat: () => ix.heartbeat(ctx, owner),
  register_asset: () => ix.registerAsset(ctx, owner, { nftMint: nft, floorPrice: 9n, hardshipFloor: 7n, askingPrice: 10n, proceedsTo: owner, docHashHex: H }),
  submit_death_claim: () => ix.submitDeathClaim(ctx, estate, ben, H),
  review_death: () => ix.reviewDeath(estate, agent, true, H),
  attest_death: () => ix.attestDeath(estate, v[0]),
  veto_death: () => ix.vetoDeath(ctx, owner),
  finalize_unlock: () => ix.finalizeUnlock(estate, ben),
  submit_claim: () => ix.submitClaim(ctx, { estate, signer: ben, ruleId: 0, claimId: 0, payeeWallet: payee, amount: 1n, evidenceHashHex: H }),
  review_claim: () => ix.reviewClaim(estate, agent, claimPda(programId, rule0, 0), rule0, false, H),
  approve_claim: () => ix.approveClaim(estate, v[1], k(), k()),
  execute_claim: () => ix.executeClaim(ctx, { estate, payer: ben, rule: k(), claim: k(), payeeWallet: payee }),
  list_asset: () => ix.listAsset(estate, agent, asset, 3600),
  place_offer: () => ix.placeOffer(ctx, estate, asset, buyer, 9n),
  withdraw_offer: () => ix.withdrawOffer(ctx, estate, asset, buyer),
  submit_hardship: () => ix.submitHardship(ctx, estate, asset, ben, H),
  review_hardship: () => ix.reviewHardship(estate, agent, asset, hardshipPda(programId, asset, ben), true, H),
  approve_hardship: () => ix.approveHardship(estate, v[2], asset, k()),
  accept_offer: () => ix.acceptOffer(ctx, { estate, agent, asset, nftMint: nft, buyer, recipient: owner }),
  owner_approve_claim: () => ix.ownerApproveClaim(ctx, owner, k(), rule0),
  execute_scheduled: () => ix.executeScheduled(ctx, { estate, payer: agent, rule: rule0, payeeWallet: payee }),
};
const idlNames = new Set(getIdl().instructions.map((i) => i.name));
const livingPlans = findInstruction("add_rule").args.length > 5;

describe("instruction builders vs IDL", () => {
  it("covers every IDL instruction", () => {
    for (const n of idlNames) expect(Object.keys(built)).toContain(n);
  });

  for (const [name, build] of Object.entries(built).filter(([n]) => idlNames.has(n))) {
    it(`${name}: resolves all accounts and round-trips data`, () => {
      const t = build();
      expect(t.programId.equals(programId)).toBe(true);
      // buildIx throws if any account is missing; check the count matches the IDL too.
      expect(t.keys.length).toBe(findInstruction(name).accounts.length);
      const decoded = getCoder().instruction.decode(Buffer.from(t.data));
      expect(decoded?.name).toBe(findInstruction(name).name);
    });
  }

  it("beneficiary instructions: the wallet signs, the PDA is beneficiary_account", () => {
    const t = built.submit_claim();
    expect(t.keys.filter((m) => m.isSigner).map((m) => m.pubkey.toBase58())).toEqual([ben.toBase58()]);
  });

  it("offer accounts use the offer PDA", () => {
    expect(built.place_offer().keys.some((m) => m.pubkey.equals(offerPda(programId, asset, buyer)))).toBe(true);
  });

  it("living-plan add_rule: recurring + starts_now (only when the IDL supports it)", () => {
    const make = () => ix.addRule(ctx, owner, {
      ruleId: 1, beneficiaryWallet: ben, category: "Accommodation", allowedPayeeKind: "Landlord", maxPerClaim: 5n, lifetimeCap: 50n,
      validUntil: 2e9, startsNow: true, recurring: { amount: 5n, intervalSecs: 60, firstDue: 1e9, payeeWallet: payee },
    });
    if (livingPlans) {
      const decoded = getCoder().instruction.decode(Buffer.from(make().data)) as { data: Record<string, unknown> } | null;
      expect(Object.values(decoded!.data)).toContain(true);
    } else {
      expect(make).toThrow(/living plans/);
    }
  });

  it("rejects malformed hashes", () => {
    expect(() => ix.setWill(ctx, owner, "xyz", "u")).toThrow(/hex/);
  });
});

describe("decoders", () => {
  it("decodes an Estate account into the UI shape", async () => {
    const raw = {
      owner, agent, usdt_mint: ctx.usdtMint, verifiers: v, death_threshold: 2, claim_threshold: 1, hardship_threshold: 2,
      waiting_period_secs: new BN(120), status: { DeathPending: {} }, will_hash: Array(32).fill(1), will_uri: "x",
      death_cert_hash: Array(32).fill(0), death_submitted_by: PublicKey.default, death_verdict: { Approved: {} },
      death_attestations: 0b101, death_pending_since: new BN(1_700_000_000), last_heartbeat: new BN(1_690_000_000),
      rule_count: 3, bump: 255,
    };
    const data = await getCoder().accounts.encode("Estate", raw);
    const back = getCoder().accounts.decode("Estate", data) as Raw;
    const e = decodeEstate("E", back, 42n);
    expect(e.status).toBe("DeathPending");
    expect(e.death.verdict).toBe("Approved");
    expect(e.death.attestations).toEqual([true, false, true]);
    expect(e.death.certHash).toBeNull();
    expect(e.death.submittedBy).toBeNull();
    expect(e.death.pendingSince).toBe(1_700_000_000);
    expect(e.willHash).toBe("01".repeat(32));
    expect(e.waitingPeriodSecs).toBe(120);
    expect(e.vaultBalance).toBe(42n);
  });
});

describe("decoders (living plans, generated IDL)", () => {
  it("decodes Rule living-plan fields", async () => {
    const { decodeRule } = await import("./decoders");
    const raw = {
      estate, id: 1, beneficiary: ben, category: { Accommodation: {} }, allowed_payee_kind: { Landlord: {} },
      max_per_claim: new BN(300), lifetime_cap: new BN(9000), spent_total: new BN(0), valid_until: new BN(2_000_000_000),
      claim_count: 0, starts_now: true, recurring_amount: new BN(300), interval_secs: new BN(60), next_due: new BN(1_800_000_000),
      fixed_payee: payee, bump: 254,
    };
    const back = getCoder().accounts.decode("Rule", await getCoder().accounts.encode("Rule", raw)) as Raw;
    const r = (await import("./decoders")).decodeRule("R", back);
    expect(r).toMatchObject({ startsNow: true, recurringAmount: 300n, intervalSecs: 60, nextDue: 1_800_000_000, fixedPayee: payee.toBase58() });
    void decodeRule;
  });
});
