/**
 * Live USD₮ → ZAR from VALR (a South African exchange) public market summary:
 *   GET https://api.valr.com/v1/public/USDTZAR/marketsummary  (no auth; verified 2026-11-11)
 * Mid of bid/ask (falls back to lastTradedPrice), cached 60 s. If VALR is unreachable we return a
 * clearly-labelled fallback rate so the UI never breaks.
 */
import type { FxRate } from "./types";

export const VALR_URL = "https://api.valr.com/v1/public/USDTZAR/marketsummary";
export const FALLBACK_USDT_ZAR = Number(process.env.FX_FALLBACK_USDT_ZAR ?? 17.5);
const TTL_MS = 60_000;

let cache: FxRate | null = null;

export function parseValrSummary(json: unknown): number | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const bid = Number(o.bidPrice);
  const ask = Number(o.askPrice);
  if (bid > 0 && ask > 0) return Math.round(((bid + ask) / 2) * 10_000) / 10_000;
  const last = Number(o.lastTradedPrice);
  return last > 0 ? last : null;
}

export async function getUsdtZar(fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<FxRate> {
  if (cache && now - cache.fetchedAt < TTL_MS) return cache;
  try {
    const res = await fetchImpl(VALR_URL, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`VALR ${res.status}`);
    const rate = parseValrSummary(await res.json());
    if (!rate) throw new Error("VALR returned no price");
    cache = { usdtZar: rate, source: "VALR USDT/ZAR (live)", fetchedAt: now };
    return cache;
  } catch {
    // Keep serving a recent live rate if we have one; otherwise the labelled fallback.
    if (cache && now - cache.fetchedAt < 10 * TTL_MS) return cache;
    return { usdtZar: FALLBACK_USDT_ZAR, source: "fallback (VALR unreachable)", fetchedAt: now };
  }
}

/** Test helper. */
export function _resetFxCache() { cache = null; }
