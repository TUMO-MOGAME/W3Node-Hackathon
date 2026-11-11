export const USDT_DECIMALS = 6;
const UNIT = 10n ** BigInt(USDT_DECIMALS);

/** Whole/decimal USD₮ (number) → base units (bigint). */
export function toBase(usdt: number): bigint {
  return BigInt(Math.round(usdt * Number(UNIT)));
}

/** Base units → number of USD₮ (display only). */
export function fromBase(base: bigint): number {
  return Number(base) / Number(UNIT);
}

export function formatUsdt(base: bigint, opts: { decimals?: number } = {}): string {
  const n = fromBase(base);
  return `${n.toLocaleString("en-ZA", { minimumFractionDigits: opts.decimals ?? 2, maximumFractionDigits: opts.decimals ?? 2 })} USD₮`;
}

export function formatZar(base: bigint, usdtZar: number): string {
  return `R ${(fromBase(base) * usdtZar).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
}

export function shortAddress(a: string, n = 4): string {
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function explorerTx(signature: string, cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function explorerAddress(address: string, cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
}
