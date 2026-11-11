import "server-only";
/**
 * Server side of fee sponsorship: policy from env, sponsor status, and validate → simulate → co-sign → (submit).
 * The sponsor is the AI agent's Tether WDK wallet (lib/agent/agent-wallet.ts), funded with devnet SOL.
 *
 * Env (all optional):
 *  SPONSOR_ENABLED=0               turn sponsorship off (default on whenever AGENT_SEED_PHRASE is set)
 *  SPONSOR_MAX_FEE_LAMPORTS=20000  max network fee per sponsored tx
 *  SPONSOR_PAYS_RENT=1             sponsor pays rent for the recipient's new USD₮ account (0 = sender pays)
 *  SPONSOR_DAILY_BUDGET_LAMPORTS   total fees + rent per server instance per day (default 0.5 SOL)
 *  SPONSOR_MIN_BALANCE_LAMPORTS    stop sponsoring below this sponsor balance (default 0.02 SOL)
 */
import { PublicKey, VersionedTransaction, type Connection } from "@solana/web3.js";
import { agentAddress, agentCoSign, hasAgentWallet } from "../agent/agent-wallet";
import { chainConfig } from "../chain/config";
import { findInstruction, getIdl } from "../chain/idl";
import { base64ToBytes, getConnection } from "../chain/tx";
import { DEFAULT_LIMITS, SPONSORED_HEIRLOOM_IXS, SponsorRejection, validateSponsoredTx, type SponsorPolicy } from "./policy";
import { DEFAULT_SPONSOR_LIMITS, SponsorLimiter } from "./limits";

const envInt = (name: string, dflt: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 && process.env[name] !== "" && process.env[name] !== undefined ? Math.floor(v) : dflt;
};

export const sponsorEnabled = () => hasAgentWallet() && process.env.SPONSOR_ENABLED !== "0" && Boolean(chainConfig.usdtMint);
export const minSponsorBalance = () => envInt("SPONSOR_MIN_BALANCE_LAMPORTS", 20_000_000);

let limiter: SponsorLimiter | null = null;
function getLimiter(): SponsorLimiter {
  if (!limiter) limiter = new SponsorLimiter({ ...DEFAULT_SPONSOR_LIMITS, dailyBudgetLamports: envInt("SPONSOR_DAILY_BUDGET_LAMPORTS", DEFAULT_SPONSOR_LIMITS.dailyBudgetLamports) });
  return limiter;
}

export async function sponsorPolicy(): Promise<SponsorPolicy> {
  const sponsor = await agentAddress();
  if (!sponsor) throw new SponsorUnavailable("The fee sponsor is not configured.");
  const names = getIdl().instructions.map((i) => i.name);
  const heirloomDiscriminators = Object.fromEntries(
    SPONSORED_HEIRLOOM_IXS.filter((n) => names.includes(n)).map((n) => [n, findInstruction(n).discriminator]),
  );
  return {
    sponsor: new PublicKey(sponsor),
    usdtMint: new PublicKey(chainConfig.usdtMint),
    usdtDecimals: 6,
    heirloomProgram: new PublicKey(getIdl().address),
    heirloomDiscriminators,
    ...DEFAULT_LIMITS,
    maxFeeLamports: envInt("SPONSOR_MAX_FEE_LAMPORTS", DEFAULT_LIMITS.maxFeeLamports),
    sponsorPaysRent: process.env.SPONSOR_PAYS_RENT !== "0",
  };
}

export class SponsorUnavailable extends Error { constructor(m: string) { super(m); this.name = "SponsorUnavailable"; } }

export interface SponsorInfo { available: boolean; feePayer: string | null; maxFeeLamports: number; paysRent: boolean; reason?: string }

/** Public info for the client: whether fees are sponsored and by which address. Never throws. */
export async function sponsorInfo(conn: Connection = getConnection()): Promise<SponsorInfo & { balanceLamports: number | null }> {
  const off = (reason: string, feePayer: string | null = null, balanceLamports: number | null = null) =>
    ({ available: false, feePayer, maxFeeLamports: 0, paysRent: false, reason, balanceLamports });
  if (!sponsorEnabled()) return off("Fee sponsorship is not configured.");
  try {
    const policy = await sponsorPolicy();
    const bal = await conn.getBalance(policy.sponsor, "confirmed");
    if (bal < minSponsorBalance()) return off("The fee sponsor is low on SOL.", policy.sponsor.toBase58(), bal);
    return { available: true, feePayer: policy.sponsor.toBase58(), maxFeeLamports: policy.maxFeeLamports, paysRent: policy.sponsorPaysRent, balanceLamports: bal };
  } catch (e) {
    return off(e instanceof Error ? e.message : "Sponsor unavailable.");
  }
}

export interface SponsorResult { signature: string; wireBase64: string; feeLamports: number; rentLamports: number; submitted: boolean }

/**
 * Validates the partially signed tx, checks limits and the sponsor's balance, simulates it (a failing tx still
 * costs the fee payer), then co-signs with the sponsor's WDK wallet. With `submit`, also broadcasts it.
 * The pay-once client uses submit=false: it stores the fully signed bytes first, then broadcasts them itself.
 */
export async function sponsorTransaction(wireBase64: string, opts: { submit: boolean }, conn: Connection = getConnection()): Promise<SponsorResult> {
  if (!sponsorEnabled()) throw new SponsorUnavailable("Fee sponsorship is not configured.");
  const policy = await sponsorPolicy();
  let wire: Uint8Array;
  try { wire = base64ToBytes(wireBase64); } catch { throw new SponsorRejection("malformed", "Transaction must be base64."); }
  const decision = validateSponsoredTx(wire, policy);
  const user = decision.signers[0];
  const cost = decision.feeLamports + decision.rentLamports;

  const lim = getLimiter();
  const limited = lim.check(user, cost, decision.rentLamports > 0);
  if (limited) throw new SponsorLimited(limited);

  const bal = await conn.getBalance(policy.sponsor, "confirmed");
  if (bal - cost < minSponsorBalance()) throw new SponsorUnavailable("The fee sponsor is low on SOL.");

  const sim = await conn.simulateTransaction(VersionedTransaction.deserialize(wire), { sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed" }).catch((e: unknown) => {
    throw new SponsorRejection("malformed", `Could not simulate: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    const anchor = logs.map((l) => l.match(/Error Code: (\w+)\. Error Number: \d+\. Error Message: (.*)$/)).find(Boolean);
    const msg = anchor ? `Rejected by the Heirloom program: ${anchor[1]} (${anchor[2].replace(/\.$/, "")})` : `Simulation failed: ${JSON.stringify(sim.value.err)}`;
    throw new SimulationFailed(msg);
  }

  const { wireBase64: full, signature } = await agentCoSign(wireBase64);
  lim.record(user, cost, decision.rentLamports > 0);
  let submitted = false;
  if (opts.submit) {
    await conn.sendRawTransaction(base64ToBytes(full), { skipPreflight: true, maxRetries: 3 });
    submitted = true;
  }
  return { signature, wireBase64: full, feeLamports: decision.feeLamports, rentLamports: decision.rentLamports, submitted };
}

export class SponsorLimited extends Error { constructor(m: string) { super(m); this.name = "SponsorLimited"; } }
export class SimulationFailed extends Error { constructor(m: string) { super(m); this.name = "SimulationFailed"; } }
