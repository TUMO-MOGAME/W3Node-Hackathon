/**
 * Turns instructions into an unsigned, serialized (base64) legacy transaction with the right fee payer
 * and a fresh blockhash. WDK (`account.sendTransaction(base64)`) signs it on the device; WDK checks the
 * fee payer equals the signing account, so the fee payer must always be the acting wallet.
 */
import { Connection, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { chainConfig } from "./config";
import { explorerTx } from "../format";

let conn: Connection | null = null;
export function getConnection(): Connection {
  if (!conn) conn = new Connection(chainConfig.rpcUrl, "confirmed");
  return conn;
}

export async function buildUnsignedTx(feePayer: PublicKey, ixs: TransactionInstruction[], connection = getConnection()): Promise<string> {
  if (ixs.length === 0) throw new Error("No instructions to send");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight }).add(...ixs);
  return bytesToBase64(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Waits for confirmation and throws a readable error (with program logs) if the tx failed. */
export async function confirmOrThrow(signature: string, connection = getConnection()): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const st = value[0];
    if (st?.err) throw new ChainTxError(signature, await describeFailure(signature, connection, st.err));
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new ChainTxError(signature, "Timed out waiting for confirmation (60 s). Check the explorer link.");
}

async function describeFailure(signature: string, connection: Connection, err: unknown): Promise<string> {
  try {
    const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    const logs = tx?.meta?.logMessages ?? [];
    return humanizeProgramError(logs) ?? `Transaction failed: ${JSON.stringify(err)}`;
  } catch {
    return `Transaction failed: ${JSON.stringify(err)}`;
  }
}

/** Pulls the Anchor error name/message out of program logs. */
export function humanizeProgramError(logs: string[]): string | null {
  for (const l of logs) {
    const m = l.match(/Error Code: (\w+)\. Error Number: \d+\. Error Message: (.*)$/);
    if (m) return `${m[1]}: ${m[2].replace(/\.$/, "")}`;
  }
  const fail = logs.find((l) => /failed:/.test(l));
  return fail ?? null;
}

export class ChainTxError extends Error {
  constructor(public signature: string, message: string) {
    super(message);
    this.name = "ChainTxError";
  }
  get explorerUrl() { return explorerTx(this.signature); }
}
