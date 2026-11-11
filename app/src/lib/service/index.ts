import type { HeirloomService } from "./types";

/**
 * Returns the active service. Mock is the default so the UI always works (also the offline demo fallback).
 * chain.ts is loaded lazily so mock mode never pulls Solana/WDK code into the bundle.
 */
let cached: Promise<HeirloomService> | null = null;

export function getService(): Promise<HeirloomService> {
  if (!cached) {
    cached =
      process.env.NEXT_PUBLIC_DATA_MODE === "chain"
        ? import("./chain").then((m) => m.createChainService())
        : import("./mock").then((m) => m.createMockService());
  }
  return cached;
}

export type { HeirloomService, EstateSnapshot, TxResult } from "./types";
