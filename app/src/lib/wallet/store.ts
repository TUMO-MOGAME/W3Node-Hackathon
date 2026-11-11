/**
 * localStorage persistence of the device's wallets: address, label, role and the PIN-encrypted seed.
 * Every access is guarded (private mode / blocked storage just means "no saved wallets").
 */
import type { Base58, Role } from "../types";
import type { EncryptedSeed } from "./crypto";

export interface StoredWallet { address: Base58; label: string; role: Role; enc: EncryptedSeed; createdAt: number }

const KEY = "heirloom.wallets.v1";
const ACTIVE = "heirloom.wallets.active";

export function loadWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredWallet[]).filter((w) => w && typeof w.address === "string" && w.enc) : [];
  } catch {
    return [];
  }
}

export function saveWallets(list: StoredWallet[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

export function loadActive(): Base58 | null {
  try { return localStorage.getItem(ACTIVE); } catch { return null; }
}

export function saveActive(address: Base58 | null): void {
  try {
    if (address) localStorage.setItem(ACTIVE, address); else localStorage.removeItem(ACTIVE);
  } catch { /* storage unavailable */ }
}
