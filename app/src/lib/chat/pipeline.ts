/**
 * One assistant turn, shared by the agent sheet (useAssistant) and the chat-first shell (useChatThreads):
 * payment requests go to the wallet assistant (Tether QVAC, or the fallback parser) and come back as a
 * "Review payment" button; everything else goes to the orchestrator in chain mode, or is answered on this
 * device in mock mode (and as a fallback when the orchestrator can't be reached).
 * No React here, so it can be tested with injected dependencies.
 */
import type { AssistantCopy } from "@/content/assistant";
import type { EstateSnapshot, HeirloomService } from "@/lib/service";
import type { FxRate, Role, WalletSession } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";
import { looksLikeSend } from "@/lib/assistant/intent";
import { describeResult, interpretRequest, reviewLabel } from "@/lib/assistant/client";
import { normaliseReply, type OrchestratorReply } from "../hooks/agent-types";
import { mockOrchestrate } from "../hooks/mock-orchestrator";

export interface TurnContext {
  service: HeirloomService | null;
  isMock: boolean;
  snap: EstateSnapshot | null;
  fx: FxRate | null;
  session: WalletSession | null;
  role: Role | null;
  page: string;
  locale: Locale;
}

export interface TurnDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  interpret: typeof interpretRequest;
}

export interface TurnResult {
  reply: OrchestratorReply;
  /** True when chain mode couldn't reach the orchestrator and the on-device answer was used. */
  fellBack: boolean;
}

const defaultDeps = (): TurnDeps => ({
  fetch: (...a) => fetch(...a),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  interpret: interpretRequest,
});

/** Runs one turn. `history` is the conversation so far (not including `text`). Never throws. */
export async function runAssistantTurn(
  text: string,
  history: { role: "user" | "agent"; text: string }[],
  c: TurnContext,
  copy: AssistantCopy,
  deps: Partial<TurnDeps> = {},
): Promise<TurnResult> {
  const d = { ...defaultDeps(), ...deps };
  const local = (): OrchestratorReply => mockOrchestrate(text, { role: c.role, address: c.session?.address ?? null, snap: c.snap, fx: c.fx }, copy);

  // The review sheet is still where the person approves or cancels: the assistant never sends by itself.
  if (c.service && looksLikeSend(text)) {
    try {
      const r = await d.interpret(text, c.service, c.fx?.usdtZar ?? null, copy.wallet);
      const engine = r.engine === "qvac" ? copy.wallet.engineQvac : copy.wallet.engineFallback;
      return {
        fellBack: false,
        reply: {
          specialist: "Orchestrator",
          reply: `${describeResult(r, copy.wallet)}\n\n${engine}${r.note ? `: ${r.note}` : ""}`,
          actions: r.plan.ok
            ? [{ type: "reviewSend", to: r.plan.to, toLabel: reviewLabel(r.plan, copy.wallet), amountUsdt: r.plan.amountUsdt }]
            : [{ type: "navigate", to: "/send" }],
        },
      };
    } catch { /* fall through to the orchestrator */ }
  }

  if (c.isMock || !c.service) {
    await d.sleep(700 + Math.min(900, text.length * 12));
    return { reply: local(), fellBack: false };
  }

  let reply: OrchestratorReply | null = null;
  try {
    const res = await d.fetch("/api/agent/orchestrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: history.map((m) => ({ role: m.role, text: m.text })),
        persona: c.session ? `${c.session.role}:${c.session.label}` : "guest",
        wallet: c.session?.address,
        estate: c.snap?.estate.address,
        page: c.page,
        locale: c.locale,
      }),
    });
    reply = res.ok ? normaliseReply(await res.json()) : null;
  } catch { reply = null; }
  return reply ? { reply, fellBack: false } : { reply: local(), fellBack: true };
}

/** The agent message text for a turn, with the fallback notice when the orchestrator couldn't be reached. */
export function turnText(r: TurnResult, copy: AssistantCopy): string {
  return r.fellBack ? `${copy.chat.errorFallback}\n\n${r.reply.reply}` : r.reply.reply;
}
