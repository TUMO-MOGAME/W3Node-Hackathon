import { PublicKey } from "@solana/web3.js";
import { handler, json, rateLimit } from "@/lib/api/http";
import { agentAddress } from "@/lib/agent/agent-wallet";
import { hasGemini } from "@/lib/agent/gemini";
import { chainConfig } from "@/lib/chain/config";
import { getIdl } from "@/lib/chain/idl";
import { getConnection } from "@/lib/chain/tx";
import { sponsorInfo } from "@/lib/sponsor/server";

export const maxDuration = 20;

const withTimeout = <T,>(p: Promise<T>, ms = 6_000): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/**
 * GET /api/health → deployment self-check (public; no secrets, only booleans and public addresses):
 * { ok, mode, cluster, programId, programDeployed, usdtMint, agentWallet, agentWalletSol, sponsorAvailable,
 *   gemini, elevenlabs, supabase }. ok = the program is deployed and RPC answers.
 */
export const GET = handler(async (req) => {
  rateLimit(req, "health", 30);
  const conn = getConnection();
  const programId = getIdl().address;
  const [program, agent] = await Promise.all([
    withTimeout(conn.getAccountInfo(new PublicKey(programId), "confirmed")).then((a) => Boolean(a?.executable)).catch(() => null),
    agentAddress().catch(() => null),
  ]);
  const [agentLamports, sponsor] = await Promise.all([
    agent ? withTimeout(conn.getBalance(new PublicKey(agent), "confirmed")).catch(() => null) : Promise.resolve(null),
    withTimeout(sponsorInfo(conn)).catch(() => ({ available: false })),
  ]);
  return json({
    ok: program === true,
    mode: chainConfig.dataMode,
    cluster: chainConfig.cluster,
    programId,
    programDeployed: program,
    usdtMint: chainConfig.usdtMint || null,
    agentWallet: agent,
    agentWalletSol: agentLamports === null ? null : agentLamports / 1e9,
    sponsorAvailable: sponsor.available,
    gemini: hasGemini(),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID),
    supabase: Boolean((process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY),
    time: new Date().toISOString(),
  });
});
