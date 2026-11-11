/**
 * Shared helpers for the devnet scripts. Every demo wallet is a Tether WDK wallet; every transaction is
 * signed and sent by WDK (`account.sendTransaction(base64)`), including ones that also need a fresh mint
 * keypair (we partially sign with the mint key first, then WDK adds the fee payer's signature).
 *
 * Seeds are written to scripts/.demo-wallets.json (gitignored). DEVNET ONLY: never put real funds in them.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { openAccount, newSeedPhrase, wdkSignAndSend, type WdkAccount } from "../app/src/lib/wallet/wdk";

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const WALLETS_FILE = join(ROOT, ".demo-wallets.json");

/** Loads app/.env.local (if present) so scripts see the same config as the app. */
export function loadEnv(): void {
  const p = join(ROOT, "..", "app", ".env.local");
  if (existsSync(p)) process.loadEnvFile(p);
}

export const rpcUrl = () => process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const connection = () => new Connection(rpcUrl(), "confirmed");

export const PERSONAS = [
  { id: "dad", label: "Thabo Mokoena (dad)", role: "owner" },
  { id: "lerato", label: "Lerato (daughter)", role: "beneficiary" },
  { id: "sipho", label: "Sipho (son)", role: "beneficiary" },
  { id: "naledi", label: "Naledi (daughter)", role: "beneficiary" },
  { id: "ndlovu", label: "Adv. Ndlovu (executor)", role: "verifier" },
  { id: "pillay", label: "Ms. Pillay (attorney)", role: "verifier" },
  { id: "bongani", label: "Uncle Bongani (family)", role: "verifier" },
  { id: "pieter", label: "Pieter (car buyer)", role: "buyer" },
  { id: "ayesha", label: "Ayesha (car buyer)", role: "buyer" },
  { id: "agent", label: "Heirloom AI agent", role: "agent" },
  { id: "uct", label: "University of Cape Town (payee)", role: "payee" },
  { id: "residence", label: "Tugwell Residence (payee)", role: "payee" },
  { id: "school", label: "Westerford High School (payee)", role: "payee" },
] as const;
export type PersonaId = (typeof PERSONAS)[number]["id"];

export interface WalletsFile {
  cluster: string;
  seeds: Record<PersonaId, string>;
  addresses: Record<PersonaId, string>;
  usdtMint?: string;
  carMint?: string;
}

export async function loadOrCreateWallets(): Promise<WalletsFile> {
  const existing = existsSync(WALLETS_FILE) ? (JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as WalletsFile) : null;
  if (existing && PERSONAS.every((p) => existing.seeds[p.id])) return existing;
  const seeds = (existing?.seeds ?? {}) as Record<PersonaId, string>;
  const addresses = (existing?.addresses ?? {}) as Record<PersonaId, string>;
  for (const p of PERSONAS) {
    if (seeds[p.id]) continue; // keep existing wallets, add any new persona
    seeds[p.id] = await newSeedPhrase();
    const acc = await openAccount(seeds[p.id], rpcUrl());
    addresses[p.id] = acc.address;
    acc.manager.dispose();
  }
  const file: WalletsFile = { ...existing, cluster: "devnet", seeds, addresses };
  saveWallets(file);
  return file;
}

export function saveWallets(f: WalletsFile): void {
  writeFileSync(WALLETS_FILE, JSON.stringify(f, null, 2), { mode: 0o600 });
}

const open = new Map<PersonaId, WdkAccount>();
export async function wdk(w: WalletsFile, id: PersonaId): Promise<WdkAccount> {
  let a = open.get(id);
  if (!a) { a = await openAccount(w.seeds[id], rpcUrl()); open.set(id, a); }
  return a;
}
export function disposeAll(): void { open.forEach((a) => a.manager.dispose()); open.clear(); }

/** Builds a tx (fee payer = WDK account), optionally partially signed by extra keypairs, then WDK signs + sends. */
export async function send(payer: WdkAccount, ixs: TransactionInstruction[], extraSigners: Keypair[] = []): Promise<string> {
  const conn = connection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: new PublicKey(payer.address), blockhash, lastValidBlockHeight }).add(...ixs);
  if (extraSigners.length) tx.partialSign(...extraSigners);
  const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  const sig = await wdkSignAndSend(payer.account, b64);
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const log = (msg: string) => console.log(`• ${msg}`);
