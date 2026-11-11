import "server-only";
/**
 * The AI agent's own Tether WDK wallet (server side, seed from AGENT_SEED_PHRASE). It may sign ONLY
 * review_death, review_claim, review_hardship, list_asset, accept_offer and execute_scheduled (it only pays the fee;
 * the program sends the fixed amount to the rule's fixed payee) for the Heirloom program; every
 * transaction is checked against that allow-list before WDK signs it. The program enforces the rest.
 */
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { chainConfig } from "../chain/config";
import { findInstruction, getIdl } from "../chain/idl";
import { prepareTx } from "../chain/client";
import { confirmOrThrow } from "../chain/tx";
import { openAccount, wdkPartialSign, wdkSignAndSend, type WdkAccount } from "../wallet/wdk";
import { explorerTx } from "../format";

export const AGENT_ALLOWED = ["review_death", "review_claim", "review_hardship", "list_asset", "accept_offer", "execute_scheduled"] as const;
export type AgentIx = (typeof AGENT_ALLOWED)[number];

let wallet: Promise<WdkAccount> | null = null;

export const hasAgentWallet = () => Boolean(process.env.AGENT_SEED_PHRASE);

function agentAccount(): Promise<WdkAccount> {
  const seed = process.env.AGENT_SEED_PHRASE;
  if (!seed) throw new Error("AGENT_SEED_PHRASE is not set, so the agent cannot sign on-chain.");
  if (!wallet) wallet = openAccount(seed, process.env.SOLANA_RPC_URL || chainConfig.rpcUrl).catch((e) => { wallet = null; throw e; });
  return wallet;
}

export async function agentAddress(): Promise<string | null> {
  if (!hasAgentWallet()) return null;
  return (await agentAccount()).address;
}

const eq = (a: Uint8Array, b: number[]) => a.length >= 8 && b.every((x, i) => a[i] === x);

/** Throws unless every instruction targets the Heirloom program with an allow-listed discriminator. */
export function assertAllowed(ixs: TransactionInstruction[]): void {
  const programId = new PublicKey(getIdl().address);
  const names = getIdl().instructions.map((i) => i.name);
  const allowed = AGENT_ALLOWED.filter((n) => names.includes(n)).map((n) => findInstruction(n).discriminator);
  for (const ix of ixs) {
    if (!ix.programId.equals(programId)) throw new Error("Agent may only call the Heirloom program.");
    if (!allowed.some((d) => eq(ix.data, d))) throw new Error("Agent is not allowed to sign this instruction.");
  }
}

export async function agentSignAndSend(ixs: TransactionInstruction[]): Promise<{ signature: string; explorerUrl: string }> {
  assertAllowed(ixs);
  const acc = await agentAccount();
  const b64 = await prepareTx(acc.address, ixs);
  const signature = await wdkSignAndSend(acc.account, b64);
  await confirmOrThrow(signature);
  return { signature, explorerUrl: explorerTx(signature) };
}

/**
 * Fee sponsorship: the agent's WDK wallet adds its fee-payer signature to a user's partially signed tx.
 * Only ever called by /api/sponsor AFTER lib/sponsor/policy.ts validated the exact bytes.
 */
export async function agentCoSign(wireBase64: string): Promise<{ wireBase64: string; signature: string }> {
  const acc = await agentAccount();
  return wdkPartialSign(acc.account, wireBase64);
}
