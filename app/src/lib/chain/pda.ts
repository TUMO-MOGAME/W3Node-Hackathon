/**
 * Every PDA seed from docs/program-spec.md. Pure functions: no RPC, safe for tests and the browser.
 */
import { PublicKey } from "@solana/web3.js";

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

const enc = new TextEncoder();
type Key = PublicKey | string;
const pk = (k: Key) => (typeof k === "string" ? new PublicKey(k) : k);

function u16le(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new RangeError(`rule id out of u16 range: ${n}`);
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

function u32le(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError(`claim id out of u32 range: ${n}`);
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

function find(programId: Key, seeds: Uint8Array[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, pk(programId))[0];
}

export const estatePda = (programId: Key, owner: Key) =>
  find(programId, [enc.encode("estate"), pk(owner).toBytes()]);

export const beneficiaryPda = (programId: Key, estate: Key, wallet: Key) =>
  find(programId, [enc.encode("beneficiary"), pk(estate).toBytes(), pk(wallet).toBytes()]);

export const payeePda = (programId: Key, estate: Key, wallet: Key) =>
  find(programId, [enc.encode("payee"), pk(estate).toBytes(), pk(wallet).toBytes()]);

export const rulePda = (programId: Key, estate: Key, ruleId: number) =>
  find(programId, [enc.encode("rule"), pk(estate).toBytes(), u16le(ruleId)]);

export const claimPda = (programId: Key, rule: Key, claimId: number) =>
  find(programId, [enc.encode("claim"), pk(rule).toBytes(), u32le(claimId)]);

export const assetPda = (programId: Key, estate: Key, nftMint: Key) =>
  find(programId, [enc.encode("asset"), pk(estate).toBytes(), pk(nftMint).toBytes()]);

export const offerPda = (programId: Key, asset: Key, buyer: Key) =>
  find(programId, [enc.encode("offer"), pk(asset).toBytes(), pk(buyer).toBytes()]);

export const hardshipPda = (programId: Key, asset: Key, beneficiaryWallet: Key) =>
  find(programId, [enc.encode("hardship"), pk(asset).toBytes(), pk(beneficiaryWallet).toBytes()]);

/** Associated token account (classic SPL Token), allowing PDA owners (off-curve). */
export function ata(mint: Key, owner: Key): PublicKey {
  return PublicKey.findProgramAddressSync(
    [pk(owner).toBytes(), TOKEN_PROGRAM_ID.toBytes(), pk(mint).toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/** USD₮ vault = ATA(usdt_mint, Estate PDA). */
export const vaultAta = (usdtMint: Key, estate: Key) => ata(usdtMint, estate);
/** Car title escrow = ATA(nft_mint, Estate PDA). */
export const nftEscrowAta = (nftMint: Key, estate: Key) => ata(nftMint, estate);
/** Buyer's escrowed USD₮ = ATA(usdt_mint, Offer PDA). */
export const offerEscrowAta = (usdtMint: Key, offer: Key) => ata(usdtMint, offer);
