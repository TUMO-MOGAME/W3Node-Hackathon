/**
 * Fixed demo personas for mock mode (NEXT_PUBLIC_DATA_MODE ≠ "chain"), so the UI works offline.
 * Addresses are valid base58 keys but hold nothing; mock signatures are clearly fake.
 * Names match the seed-demo story (Thabo's estate).
 */
import type { Role, WalletSession } from "../types";

export interface DemoPersona { address: string; label: string; role: Role; usdt: number; sol: number }

export const DEMO_PERSONAS: DemoPersona[] = [
  { address: "YdzZuEsaYP4FJhVaNzT9UbiUqWG24D7dP14isb7U368", label: "Thabo Mokoena (dad)", role: "owner", usdt: 25_000, sol: 2 },
  { address: "6ckEzZLHJ4XLXLP7jrkjFau22cK8KhV2cVeWyhqJmSWm", label: "Lerato (daughter)", role: "beneficiary", usdt: 0, sol: 0.5 },
  { address: "2sAMPfndNtAWWqsRmMbBkYRxBBgQGZLnUTVmGwYcBrwu", label: "Sipho (son)", role: "beneficiary", usdt: 0, sol: 0.5 },
  { address: "6veGKXYUDGqBDjrP4137igAiMWpRHiwiGCUH8ssjKU8z", label: "Naledi (daughter)", role: "beneficiary", usdt: 0, sol: 0.5 },
  { address: "3Shi7YitQt1uDDnmfGbL9EEkespgos2QpCDaph5Go2at", label: "Adv. Ndlovu (executor)", role: "verifier", usdt: 0, sol: 0.5 },
  { address: "GpufgMWp8sgFEYgaJ1XoEu42JG7pKVBD4kfaDbohp8rM", label: "Ms. Pillay (attorney)", role: "verifier", usdt: 0, sol: 0.5 },
  { address: "ALpw94XmFYogivyVbrHq1NGuvY5fqxryyqkxmbiiRtHm", label: "Uncle Bongani (family)", role: "verifier", usdt: 0, sol: 0.5 },
  { address: "BMajP1ye9ZJg18xBQ6GX9fL8cTzFJQ9roQuqQdSZMrq1", label: "Pieter (car buyer)", role: "buyer", usdt: 12_000, sol: 1 },
];

export function personaSessions(): WalletSession[] {
  return DEMO_PERSONAS.map((p) => ({
    address: p.address, label: p.label, role: p.role, solBalance: p.sol, usdtBalance: BigInt(p.usdt) * 1_000_000n,
  }));
}

/** A fake base58-looking signature, prefixed so nobody mistakes it for a real one. */
export function mockSignature(): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const rnd = crypto.getRandomValues(new Uint8Array(80));
  return "MOCK" + Array.from(rnd, (b) => alphabet[b % alphabet.length]).join("");
}
