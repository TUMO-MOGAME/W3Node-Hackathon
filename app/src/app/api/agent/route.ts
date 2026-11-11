import { handler, json, rateLimit } from "@/lib/api/http";
import { agentAddress } from "@/lib/agent/agent-wallet";
import { geminiModel, hasGemini } from "@/lib/agent/gemini";

/** GET /api/agent → the agent's public WDK wallet address and which AI/voice features are live (request-time). */
export const GET = handler(async (req) => {
  rateLimit(req, "agent-info", 60); // also makes this route request-time rather than prerendered
  return json({
    agentAddress: await agentAddress().catch(() => null),
    model: geminiModel(),
    gemini: hasGemini(),
    voice: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID),
  });
});
