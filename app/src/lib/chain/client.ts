/**
 * Chain client entry point: the program/mint context and "instructions → unsigned base64 tx".
 * Signing is never done here; the caller hands the base64 to a WDK account (browser: wallet/signer.ts,
 * server: agent/agent-wallet.ts).
 */
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { getIdl } from "./idl";
import { requireUsdtMint } from "./config";
import { buildUnsignedTx } from "./tx";
import type { Ctx } from "./instructions";

export function chainCtx(): Ctx {
  return { programId: new PublicKey(getIdl().address), usdtMint: new PublicKey(requireUsdtMint()) };
}

/** Unsigned legacy transaction, base64, fee payer = the wallet that will sign it. */
export function prepareTx(feePayer: string | PublicKey, ixs: TransactionInstruction[]): Promise<string> {
  return buildUnsignedTx(typeof feePayer === "string" ? new PublicKey(feePayer) : feePayer, ixs);
}

export * as ix from "./instructions";
export { fetchEstateRaw, fetchActivity, findEstateOf } from "./reads";
export { confirmOrThrow, getConnection, humanizeProgramError, ChainTxError } from "./tx";
export * as pda from "./pda";
