/**
 * Chat-first shell: saved conversations ("Chats" in the sidebar) and "needs your attention" nudges on the home screen.
 * Implemented by the chat data agent in ./threads.ts (useChatThreads) and ./nudges.ts (useNudges);
 * the UI (sidebar + chat home) is built by the design agent against this file. Don't change shapes without updating both.
 */
import type { AgentAction, AssistantMessage } from "../hooks/agent-types";

export interface ChatAttachment {
  name: string;
  kind: "pdf" | "image";
  /** What the agent should do with it (maps to the document reviewer purposes). */
  purpose?: "death" | "claim" | "hardship" | "general";
}

export interface ChatThreadMessage extends AssistantMessage {
  ts: number;
  attachment?: ChatAttachment;
}

export interface ChatThread {
  id: string;
  /** Short title derived from the first user message (≤ 40 chars), user-renamable. */
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatThreadMessage[];
}

export interface ChatThreadsApi {
  /** Threads for the persona currently acting (each persona — dad, Lerato, a verifier — has their own history), newest first. */
  threads: ChatThread[];
  activeId: string | null;
  active: ChatThread | null;
  /** True while waiting for the agent's reply in the active thread. */
  busy: boolean;
  /** Starts a fresh empty thread and makes it active (the chat home shows the welcome state when messages is empty). */
  newThread(): string;
  select(id: string): void;
  rename(id: string, title: string): void;
  remove(id: string): void;
  /** Sends a message (and optional document) in the active thread, creating one if none; routes through the orchestrator / wallet assistant like useAssistant. */
  send(text: string, opts?: { attachment?: File; purpose?: ChatAttachment["purpose"] }): Promise<void>;
  /** Suggested prompts for the empty state, depending on role and estate status. */
  suggestions: string[];
}

export type NudgeKind =
  | "scheduled-due"     // a scheduled payment is due now (owner/anyone)
  | "claim-to-approve"  // owner (living plan) or verifier needs to approve a claim
  | "death-to-confirm"  // verifier needs to confirm a reported passing
  | "unlock-ready"      // waiting period over, estate can be unlocked
  | "hardship-to-review"
  | "offer-received"    // car listing has offers / agent can settle
  | "legacy-message"    // a child has a new message from their parent for a milestone
  | "heartbeat"         // owner hasn't checked in for a while
  | "fund-vault";       // vault balance below upcoming payments

export interface Nudge {
  id: string;           // stable per underlying item, so dismissals stick
  kind: NudgeKind;
  title: string;        // "A payment is due today"
  body: string;         // "Lerato's book allowance (85 USD₮ · R1 420) is due. Want me to pay it now?"
  primary: { label: string; action: AgentAction | { type: "run"; op: "executeScheduled" | "finalizeUnlock"; target: string } };
  secondary?: { label: string; dismiss: true };
  urgency: "now" | "soon" | "info";
}

export interface NudgesApi {
  nudges: Nudge[];      // not dismissed, most urgent first
  dismiss(id: string): void;
}
