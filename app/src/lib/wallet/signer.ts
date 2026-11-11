/**
 * Module singleton that holds the active wallet's signer, so non-React code (service/chain.ts) can sign
 * with whatever wallet the UI has active. WalletProvider keeps it in sync.
 */
import type { Base58 } from "../types";

export interface ActiveSigner {
  address: Base58;
  signAndSend(base64Tx: string): Promise<string>;
}

let active: ActiveSigner | null = null;
const listeners = new Set<(s: ActiveSigner | null) => void>();

export function setActiveSigner(s: ActiveSigner | null): void {
  active = s;
  listeners.forEach((l) => l(s));
}

export function getActiveSigner(): ActiveSigner {
  if (!active) throw new Error("No wallet is active. Create or choose a wallet first.");
  return active;
}

export function peekActiveSigner(): ActiveSigner | null {
  return active;
}

export function onSignerChange(fn: (s: ActiveSigner | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
