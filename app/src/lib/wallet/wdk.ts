/**
 * Thin wrapper over Tether WDK (@tetherto/wdk-wallet-solana) used by both the browser wallet and the
 * server-side agent wallet. All key material stays inside WDK's WalletAccountSolana.
 *
 * WDK APIs used (verified against v1.0.0-beta.20 .d.ts + a local signing test):
 *  - WalletManagerSolana.getRandomSeedPhrase(12) / isValidSeedPhrase(seed)
 *  - new WalletManagerSolana(seed, { provider, commitment }).getAccount(0)  → m/44'/501'/0'/0'
 *  - account.getAddress(), getBalance() (lamports), getTokenBalance(mint) (base units)
 *  - account.sendTransaction(base64Tx) → { hash, fee }  (WDK checks fee payer == account, signs, broadcasts)
 *  - account.transfer({ token, recipient, amount })     (SPL USD₮ transfer, used by scripts)
 *  - new WalletAccountReadOnlySolana(address, { provider }) for balances of locked wallets
 *  - account.dispose() / manager.dispose() to wipe keys from memory
 */
import type WalletManagerSolanaT from "@tetherto/wdk-wallet-solana";
import type { WalletAccountSolana as WalletAccountSolanaT, WalletAccountReadOnlySolana as ReadOnlyT } from "@tetherto/wdk-wallet-solana";

type WdkModule = typeof import("@tetherto/wdk-wallet-solana");

let modPromise: Promise<WdkModule> | null = null;

/** Loads WDK lazily. In the browser it first installs the Buffer global that bip39 expects. */
export function loadWdk(): Promise<WdkModule> {
  if (!modPromise) {
    modPromise = (async () => {
      if (typeof window !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
        const { Buffer } = await import("buffer");
        (globalThis as { Buffer?: unknown }).Buffer = Buffer;
      }
      return import("@tetherto/wdk-wallet-solana");
    })();
  }
  return modPromise;
}

export interface WdkAccount {
  manager: WalletManagerSolanaT;
  account: WalletAccountSolanaT;
  address: string;
}

export async function newSeedPhrase(): Promise<string> {
  const { default: Manager } = await loadWdk();
  return Manager.getRandomSeedPhrase(12);
}

export async function isValidSeed(seed: string): Promise<boolean> {
  const { default: Manager } = await loadWdk();
  return Manager.isValidSeedPhrase(seed.trim());
}

export async function openAccount(seedPhrase: string, rpcUrl: string, index = 0): Promise<WdkAccount> {
  const { default: Manager } = await loadWdk();
  const manager = new Manager(seedPhrase.trim(), { provider: rpcUrl, commitment: "confirmed" });
  const account = await manager.getAccount(index);
  return { manager, account, address: await account.getAddress() };
}

export async function readOnly(address: string, rpcUrl: string): Promise<ReadOnlyT> {
  const { WalletAccountReadOnlySolana } = await loadWdk();
  return new WalletAccountReadOnlySolana(address, { provider: rpcUrl, commitment: "confirmed" });
}

/** Signs and broadcasts a base64 tx with WDK; returns the signature. Errors carry program logs when available. */
export async function wdkSignAndSend(account: WalletAccountSolanaT, base64Tx: string): Promise<string> {
  try {
    const { hash } = await account.sendTransaction(base64Tx);
    return hash;
  } catch (e) {
    throw new Error(explainSendError(e));
  }
}

/** Digs program logs out of a @solana/kit preflight error and returns a readable message. */
export function explainSendError(e: unknown): string {
  const logs = findLogs(e);
  if (logs) {
    for (const l of logs) {
      const m = l.match(/Error Code: (\w+)\. Error Number: \d+\. Error Message: (.*)$/);
      if (m) return `Rejected by the Heirloom program: ${m[1]} (${m[2].replace(/\.$/, "")})`;
    }
    const failed = logs.find((l) => /failed/i.test(l));
    if (failed) return `Transaction failed: ${failed}`;
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/insufficient (funds|lamports)|0x1\b/i.test(msg)) return "Not enough SOL for fees or not enough USD₮ for this transfer.";
  if (/blockhash/i.test(msg)) return "The transaction expired before it was sent. Please try again.";
  return msg;
}

function findLogs(e: unknown, depth = 0): string[] | null {
  if (!e || typeof e !== "object" || depth > 4) return null;
  const o = e as { context?: { logs?: unknown; __serverMessage?: unknown }; logs?: unknown; cause?: unknown };
  if (Array.isArray(o.context?.logs)) return o.context.logs as string[];
  if (Array.isArray(o.logs)) return o.logs as string[];
  return findLogs(o.cause, depth + 1);
}

/**
 * Signs (does NOT broadcast) a base64 tx with WDK and returns the signature + signed wire bytes, so the payment
 * pipeline can persist the signature before broadcasting (pay-once; see ./payments.ts).
 */
export async function wdkSign(account: WalletAccountSolanaT, base64Tx: string): Promise<{ signature: string; wireBase64: string }> {
  // @solana/kit Transaction shape: { messageBytes, signatures: { [address]: bytes } } in signer order.
  const signed = (await account.signTransaction(base64Tx)) as unknown as { messageBytes: Uint8Array; signatures: Record<string, Uint8Array | null> };
  const sigs = Object.values(signed.signatures);
  if (!sigs[0]) throw new Error("WDK returned an unsigned transaction.");
  const { default: bs58 } = await import("bs58");
  return { signature: bs58.encode(sigs[0]), wireBase64: encodeWire(sigs, signed.messageBytes) };
}

/** Solana wire format: compact-u16 signature count, 64-byte signatures (fee payer first), message bytes. */
export function encodeWire(sigs: (Uint8Array | null)[], message: Uint8Array): string {
  const len: number[] = [];
  let n = sigs.length;
  do { let b = n & 0x7f; n >>= 7; if (n) b |= 0x80; len.push(b); } while (n);
  const out = new Uint8Array(len.length + sigs.length * 64 + message.length);
  out.set(len, 0);
  sigs.forEach((s, i) => out.set(s ?? new Uint8Array(64), len.length + i * 64));
  out.set(message, len.length + sigs.length * 64);
  let bin = "";
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return btoa(bin);
}

// ---------- partial signing (sponsored fees) ----------

/** The parts of a Solana wire transaction we need for partial signing. Works for legacy and v0 messages. */
export interface DecodedWire { signatures: (Uint8Array | null)[]; message: Uint8Array; signerKeys: Uint8Array[]; versioned: boolean }

function readCompactU16(b: Uint8Array, at: number): [value: number, next: number] {
  let value = 0, shift = 0, i = at;
  for (;;) {
    if (i >= b.length || shift > 14) throw new Error("Malformed transaction.");
    const byte = b[i++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return [value, i];
    shift += 7;
  }
}

export function decodeWire(wire: Uint8Array): DecodedWire {
  const [n, sigStart] = readCompactU16(wire, 0);
  const msgStart = sigStart + n * 64;
  if (n === 0 || msgStart > wire.length) throw new Error("Malformed transaction.");
  const signatures = Array.from({ length: n }, (_, i) => {
    const s = wire.slice(sigStart + i * 64, sigStart + (i + 1) * 64);
    return s.every((x) => x === 0) ? null : s;
  });
  const message = wire.slice(msgStart);
  const versioned = (message[0] & 0x80) !== 0;
  const h = versioned ? 1 : 0;
  const numRequired = message[h];
  if (numRequired !== n) throw new Error("Signature count does not match the message header.");
  const [keyCount, keysStart] = readCompactU16(message, h + 3);
  if (keyCount < numRequired || keysStart + keyCount * 32 > message.length) throw new Error("Malformed transaction.");
  const signerKeys = Array.from({ length: numRequired }, (_, i) => message.slice(keysStart + i * 32, keysStart + (i + 1) * 32));
  return { signatures, message, signerKeys, versioned };
}

/**
 * Partially signs a base64 wire tx with a WDK account, for transactions whose fee payer is someone else (the
 * Heirloom fee sponsor). WDK's public signTransaction() insists the account is the fee payer, so we use the
 * account's own @solana/kit KeyPairSigner (the same signer WDK signs with internally): the key never leaves WDK.
 * Returns the wire bytes with this account's signature in its slot; other slots are left as they were.
 */
export async function wdkPartialSign(account: WalletAccountSolanaT, base64Tx: string): Promise<{ wireBase64: string; signature: string }> {
  const { default: bs58 } = await import("bs58");
  const wire = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));
  const d = decodeWire(wire);
  const me = await account.getAddress();
  const idx = d.signerKeys.findIndex((k) => bs58.encode(k) === me);
  if (idx < 0) throw new Error("This wallet is not a signer of the transaction.");
  const getSigner = (account as unknown as { _getSigner?: () => Promise<{ address: string; signMessages(m: { content: Uint8Array; signatures: Record<string, Uint8Array> }[]): Promise<Record<string, Uint8Array>[]> }> })._getSigner;
  if (typeof getSigner !== "function") throw new Error("This WDK version cannot co-sign sponsored transactions.");
  const signer = await getSigner.call(account);
  if (signer.address !== me) throw new Error("WDK signer does not match the wallet address.");
  const [map] = await signer.signMessages([{ content: d.message, signatures: {} }]);
  const sig = map?.[me];
  if (!sig || sig.length !== 64) throw new Error("WDK did not return a signature.");
  d.signatures[idx] = sig;
  return { wireBase64: encodeWire(d.signatures, d.message), signature: bs58.encode(sig) };
}
