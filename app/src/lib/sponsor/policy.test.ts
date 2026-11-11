import { describe, expect, it } from "vitest";
import {
  ComputeBudgetProgram, Keypair, MessageV0, PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createApproveInstruction, createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction, createTransferCheckedInstruction, createTransferInstruction, getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { findInstruction, getIdl } from "../chain/idl";
import { DEFAULT_LIMITS, SPONSORED_HEIRLOOM_IXS, SponsorRejection, TOKEN_ACCOUNT_RENT, validateSponsoredTx, type RejectCode, type SponsorPolicy } from "./policy";
import { SponsorLimiter } from "./limits";

const sponsor = Keypair.generate();
const user = Keypair.generate();
const other = Keypair.generate();
const recipient = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;
const fakeMint = Keypair.generate().publicKey;
const programId = new PublicKey(getIdl().address);
const BLOCKHASH = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";

const names = getIdl().instructions.map((i) => i.name);
const policy = (over: Partial<SponsorPolicy> = {}): SponsorPolicy => ({
  sponsor: sponsor.publicKey, usdtMint: mint, usdtDecimals: 6, heirloomProgram: programId,
  heirloomDiscriminators: Object.fromEntries(SPONSORED_HEIRLOOM_IXS.filter((n) => names.includes(n)).map((n) => [n, findInstruction(n).discriminator])),
  ...DEFAULT_LIMITS, sponsorPaysRent: true, ...over,
});

const ataOf = (owner: PublicKey, m = mint) => getAssociatedTokenAddressSync(m, owner, true);
const transfer = (amount = 1_000_000n, from = user.publicKey, m = mint, decimals = 6, to = recipient) =>
  createTransferCheckedInstruction(ataOf(from, m), m, ataOf(to, m), from, amount, decimals);
const createAta = (payer = sponsor.publicKey, owner = recipient, m = mint) =>
  createAssociatedTokenAccountIdempotentInstruction(payer, ataOf(owner, m), owner, m);
const heirloomIx = (name: string, keys: PublicKey[] = [user.publicKey]) => new TransactionInstruction({
  programId, keys: keys.map((k, i) => ({ pubkey: k, isSigner: i === 0, isWritable: true })),
  data: Buffer.from([...findInstruction(name).discriminator, 0, 0]),
});

function wire(ixs: TransactionInstruction[], o: { feePayer?: PublicKey; signers?: Keypair[]; signSponsor?: boolean } = {}): Uint8Array {
  const tx = new Transaction({ feePayer: o.feePayer ?? sponsor.publicKey, recentBlockhash: BLOCKHASH }).add(...ixs);
  const signers = o.signers ?? [user];
  if (o.signSponsor) tx.partialSign(sponsor, ...signers); else if (signers.length) tx.partialSign(...signers);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}

function rejects(w: Uint8Array, code: RejectCode, p = policy()) {
  try {
    validateSponsoredTx(w, p);
  } catch (e) {
    expect(e).toBeInstanceOf(SponsorRejection);
    expect((e as SponsorRejection).code).toBe(code);
    return;
  }
  throw new Error(`expected rejection ${code}`);
}

describe("sponsor policy: allowed", () => {
  it("accepts a USD₮ transfer with the sponsor as fee payer", () => {
    const d = validateSponsoredTx(wire([transfer()]), policy());
    expect(d.signers).toEqual([user.publicKey.toBase58()]);
    expect(d.feeLamports).toBe(10_000);
    expect(d.rentLamports).toBe(0);
  });

  it("accepts creating the recipient's USD₮ account with sponsor-paid rent when USD₮ goes into it", () => {
    const d = validateSponsoredTx(wire([createAta(), transfer()]), policy());
    expect(d.rentLamports).toBe(TOKEN_ACCOUNT_RENT);
  });

  it("accepts user-paid ATA creation even when the sponsor does not pay rent", () => {
    const d = validateSponsoredTx(wire([createAta(user.publicKey), transfer()]), policy({ sponsorPaysRent: false }));
    expect(d.rentLamports).toBe(0);
  });

  it("accepts allow-listed Heirloom instructions and compute-budget instructions within caps", () => {
    const d = validateSponsoredTx(wire([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
      heirloomIx("submit_claim"), heirloomIx("deposit"),
    ]), policy());
    expect(d.feeLamports).toBe(10_000 + 2_000); // 200k CU × 10k µlamports = 2000 lamports priority
  });

  it("accepts a second user signer (e.g. buyer + owner) within the signer cap", () => {
    const ix = new TransactionInstruction({ programId, data: Buffer.from([...findInstruction("heartbeat").discriminator]), keys: [
      { pubkey: user.publicKey, isSigner: true, isWritable: true }, { pubkey: other.publicKey, isSigner: true, isWritable: false },
    ] });
    expect(validateSponsoredTx(wire([ix], { signers: [user, other] }), policy()).signers).toHaveLength(2);
  });
});

describe("sponsor policy: rejected", () => {
  it("rejects SOL transfers from the sponsor", () => rejects(wire([SystemProgram.transfer({ fromPubkey: sponsor.publicKey, toPubkey: user.publicKey, lamports: 1_000_000 }), heirloomIx("heartbeat")]), "unknown_program"));
  it("rejects SOL transfers from the user too (System program is not allowed)", () => rejects(wire([SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: recipient, lamports: 1 }), transfer()]), "unknown_program"));
  it("rejects unknown programs", () => rejects(wire([new TransactionInstruction({ programId: Keypair.generate().publicKey, keys: [{ pubkey: user.publicKey, isSigner: true, isWritable: true }], data: Buffer.from([1]) })]), "unknown_program"));
  it("rejects Token-2022 transfers", () => rejects(wire([createTransferCheckedInstruction(ataOf(user.publicKey), mint, ataOf(recipient), user.publicKey, 1n, 6, [], TOKEN_2022_PROGRAM_ID)]), "unknown_program"));
  it("rejects the wrong mint", () => rejects(wire([transfer(1n, user.publicKey, fakeMint)]), "wrong_mint"));
  it("rejects the wrong decimals", () => rejects(wire([transfer(1n, user.publicKey, mint, 9)]), "wrong_mint"));
  it("rejects a zero amount", () => rejects(wire([transfer(0n)]), "bad_token_ix"));
  it("rejects the sponsor as token authority (spending the sponsor's USD₮)", () => rejects(wire([transfer(1n, sponsor.publicKey)], { signers: [] }), "missing_signature"));
  it("rejects the sponsor as token authority even if it appears signed", () => {
    // the sponsor key in a token ix is refused before anything else about it
    rejects(wire([transfer(1n, sponsor.publicKey), heirloomIx("deposit")]), "sponsor_in_instruction");
  });
  it("rejects plain Transfer, Approve and CloseAccount token instructions", () => {
    rejects(wire([createTransferInstruction(ataOf(user.publicKey), ataOf(recipient), user.publicKey, 1n)]), "bad_token_ix");
    rejects(wire([createApproveInstruction(ataOf(user.publicKey), recipient, user.publicKey, 1n)]), "bad_token_ix");
    rejects(wire([createCloseAccountInstruction(ataOf(user.publicKey), sponsor.publicKey, user.publicKey)]), "bad_token_ix");
  });
  it("rejects multisig token authorities", () => rejects(wire([createTransferCheckedInstruction(ataOf(user.publicKey), mint, ataOf(recipient), user.publicKey, 1n, 6, [other.publicKey])], { signers: [other] }), "bad_token_ix"));
  it("rejects a token account owned by the sponsor", () => rejects(wire([createAta(user.publicKey, sponsor.publicKey)]), "sponsor_in_instruction"));
  it("rejects an ATA for another mint", () => rejects(wire([createAta(sponsor.publicKey, recipient, fakeMint), transfer()]), "wrong_mint"));
  it("rejects an ATA whose address does not match its owner", () => {
    const ix = createAta();
    ix.keys[1] = { ...ix.keys[1], pubkey: ataOf(other.publicKey) };
    rejects(wire([ix, transfer()]), "bad_ata_ix");
  });
  it("rejects sponsor-paid rent for an account that receives no USD₮", () => rejects(wire([createAta(), transfer(1n, user.publicKey, mint, 6, other.publicKey)]), "rent_not_allowed"));
  it("rejects sponsor-paid rent when rent sponsorship is off", () => rejects(wire([createAta(), transfer()]), "rent_not_allowed", policy({ sponsorPaysRent: false })));
  it("rejects more than one account creation", () => rejects(wire([createAta(), createAta(sponsor.publicKey, other.publicKey), transfer()]), "bad_ata_ix"));
  it("rejects agent-only Heirloom instructions", () => {
    for (const n of ["review_death", "review_claim", "list_asset", "accept_offer"].filter((x) => names.includes(x))) rejects(wire([heirloomIx(n)]), "bad_heirloom_ix");
  });
  it("rejects unknown Heirloom discriminators and short data", () => {
    rejects(wire([new TransactionInstruction({ programId, keys: [{ pubkey: user.publicKey, isSigner: true, isWritable: true }], data: Buffer.alloc(8, 7) })]), "bad_heirloom_ix");
    rejects(wire([new TransactionInstruction({ programId, keys: [{ pubkey: user.publicKey, isSigner: true, isWritable: true }], data: Buffer.from([1, 2]) })]), "bad_heirloom_ix");
  });
  it("rejects the sponsor as an account of a Heirloom instruction (e.g. as payer)", () => rejects(wire([heirloomIx("execute_claim", [user.publicKey, sponsor.publicKey])]), "sponsor_in_instruction"));
  it("rejects a fee payer other than the sponsor", () => rejects(wire([transfer()], { feePayer: user.publicKey }), "wrong_fee_payer"));
  it("rejects a tx the sponsor already signed", () => rejects(wire([transfer()], { signSponsor: true }), "sponsor_signed"));
  it("rejects a missing user signature", () => rejects(wire([transfer()], { signers: [] }), "missing_signature"));
  it("rejects a tampered signature", () => {
    const w = wire([transfer()]);
    w[1 + 64 + 5] ^= 0xff; // second signature slot (the user's)
    rejects(w, "bad_signature");
  });
  it("rejects a message changed after signing", () => {
    const w = wire([transfer(1_000_000n)]);
    w[w.length - 2] ^= 0x01; // amount byte inside the transfer data
    rejects(w, "bad_signature");
  });
  it("rejects too many signers", () => {
    const k = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const ix = new TransactionInstruction({ programId, data: Buffer.from(findInstruction("heartbeat").discriminator), keys: k.map((x) => ({ pubkey: x.publicKey, isSigner: true, isWritable: false })) });
    rejects(wire([ix], { signers: k }), "too_many_signers");
  });
  it("rejects compute budget abuse", () => {
    rejects(wire([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000_000 }), transfer()]), "bad_compute_budget");
    rejects(wire([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), transfer()]), "bad_compute_budget");
    rejects(wire([ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }), transfer()]), "bad_compute_budget");
    rejects(wire([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }), transfer()]), "bad_compute_budget");
  });
  it("rejects fees above the cap", () => rejects(wire([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }), transfer()]), "fee_too_high", policy({ maxFeeLamports: 15_000 })));
  it("rejects a tx with only compute-budget instructions (no user to sponsor)", () => rejects(wire([ComputeBudgetProgram.setComputeUnitLimit({ units: 1000 })], { signers: [] }), "missing_signature"));
  it("rejects versioned (v0) transactions", () => {
    const msg = MessageV0.compile({ payerKey: sponsor.publicKey, recentBlockhash: BLOCKHASH, instructions: [transfer()] });
    const v = new VersionedTransaction(msg);
    v.sign([user]);
    rejects(v.serialize(), "versioned");
  });
  it("rejects garbage and oversized input", () => {
    rejects(new Uint8Array([1, 2, 3]), "malformed");
    rejects(new Uint8Array(1300), "too_large");
  });
});

describe("sponsor limiter", () => {
  it("limits per wallet per minute and per day, rent creations, and the daily budget", () => {
    const l = new SponsorLimiter({ perMinute: 2, perDay: 3, rentPerDay: 1, dailyBudgetLamports: 3_000_000 });
    const t = 1_000_000;
    expect(l.check("a", 10_000, false, t)).toBeNull();
    l.record("a", 10_000, false, t);
    l.record("a", 10_000, false, t + 1);
    expect(l.check("a", 10_000, false, t + 2)).toMatch(/wait a minute/);
    expect(l.check("b", 10_000, false, t + 2)).toBeNull();
    l.record("a", 10_000, false, t + 61_000);
    expect(l.check("a", 10_000, false, t + 122_000)).toMatch(/today's limit/);
    l.record("c", TOKEN_ACCOUNT_RENT, true, t);
    expect(l.check("c", TOKEN_ACCOUNT_RENT, true, t + 120_000)).toMatch(/new accounts/);
    expect(l.check("d", 1_000_000, false, t)).toMatch(/budget/);
    expect(l.check("a", 10_000, false, t + 86_400_000 + 1)).toBeNull(); // next day
  });
});

describe("ATA program id sanity", () => {
  it("uses the classic ATA program", () => expect(createAta().programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true));
  it("uses the classic token program", () => expect(transfer().programId.equals(TOKEN_PROGRAM_ID)).toBe(true));
});
