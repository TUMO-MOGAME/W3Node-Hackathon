/**
 * In-memory limits for the fee sponsor (per server instance; enough for a demo, swap for Redis/Supabase later):
 * per-wallet sliding windows (per minute, per day), sponsored-rent creations per wallet per day, and a
 * daily lamport budget for the whole sponsor.
 */
export interface SponsorLimits { perMinute: number; perDay: number; rentPerDay: number; dailyBudgetLamports: number }

export const DEFAULT_SPONSOR_LIMITS: SponsorLimits = { perMinute: 6, perDay: 60, rentPerDay: 3, dailyBudgetLamports: 500_000_000 };

const MIN = 60_000, DAY = 86_400_000;

export class SponsorLimiter {
  private hits = new Map<string, number[]>();
  private rent = new Map<string, number[]>();
  private spent: { at: number; lamports: number }[] = [];
  constructor(private limits: SponsorLimits = DEFAULT_SPONSOR_LIMITS) {}

  private recent(m: Map<string, number[]>, key: string, now: number, window: number): number[] {
    const xs = (m.get(key) ?? []).filter((t) => now - t < window);
    m.set(key, xs);
    return xs;
  }

  /** Returns a reason string when the request must be refused; null when it may proceed. Does not record. */
  check(wallet: string, lamports: number, rent: boolean, now = Date.now()): string | null {
    const day = this.recent(this.hits, wallet, now, DAY);
    if (day.filter((t) => now - t < MIN).length >= this.limits.perMinute) return "Too many sponsored transactions from this wallet. Please wait a minute.";
    if (day.length >= this.limits.perDay) return "This wallet reached today's limit of sponsored transactions.";
    if (rent && this.recent(this.rent, wallet, now, DAY).length >= this.limits.rentPerDay) return "This wallet reached today's limit of sponsored new accounts.";
    this.spent = this.spent.filter((s) => now - s.at < DAY);
    const used = this.spent.reduce((a, s) => a + s.lamports, 0);
    if (used + lamports > this.limits.dailyBudgetLamports) return "The fee sponsor's daily budget is used up.";
    return null;
  }

  record(wallet: string, lamports: number, rent: boolean, now = Date.now()): void {
    this.recent(this.hits, wallet, now, DAY).push(now);
    if (rent) this.recent(this.rent, wallet, now, DAY).push(now);
    this.spent.push({ at: now, lamports });
    if (this.hits.size > 50_000) this.hits.clear();
    if (this.rent.size > 50_000) this.rent.clear();
  }
}
