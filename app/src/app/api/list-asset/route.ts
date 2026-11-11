import { PublicKey } from "@solana/web3.js";
import { handler, HttpError, isChainMode, json, parseJson, rateLimit } from "@/lib/api/http";
import { listAssetBody } from "@/lib/agent/schemas";
import { listAsset } from "@/lib/chain/instructions";
import { agentAddress, agentSignAndSend, hasAgentWallet } from "@/lib/agent/agent-wallet";

export const maxDuration = 60;

/** POST /api/list-asset { estate, asset, durationSecs } → the agent's WDK wallet signs list_asset. */
export const POST = handler(async (req) => {
  rateLimit(req, "list-asset", 5);
  const b = await parseJson(req, listAssetBody);
  if (!isChainMode()) throw new HttpError(409, "On-chain listing runs in chain mode only.");
  if (!hasAgentWallet()) throw new HttpError(503, "The agent wallet is not configured (AGENT_SEED_PHRASE).");
  const agent = new PublicKey((await agentAddress())!);
  const tx = await agentSignAndSend([listAsset(new PublicKey(b.estate), agent, new PublicKey(b.asset), b.durationSecs)]);
  return json(tx);
});
