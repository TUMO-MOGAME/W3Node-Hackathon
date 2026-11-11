/**
 * UI intents the agent (text orchestrator or voice) can ask the app to perform. Client-safe.
 * The UI listens with `onAgentAction()`; voice client tools and /api/agent/orchestrate both emit these.
 */
import { z } from "zod";

export const uiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), path: z.string().regex(/^\/[\w\-/[\]?=&.%]*$/).max(200) }),
  z.object({
    type: z.literal("openClaimForm"),
    rule: z.string().max(64).optional(),
    payee: z.string().max(64).optional(),
    amount: z.number().nonnegative().max(100_000_000).optional(),
  }),
  z.object({ type: z.literal("showRule"), rule: z.string().max(64) }),
  z.object({ type: z.literal("startUpload"), purpose: z.enum(["death", "claim", "hardship"]) }),
]);

export type UiAction = z.infer<typeof uiActionSchema>;

/** Browser event name carrying a UiAction in `detail`. */
export const AGENT_ACTION_EVENT = "heirloom:agent-action";

export function dispatchAgentAction(action: UiAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<UiAction>(AGENT_ACTION_EVENT, { detail: action }));
}

/** Subscribe to agent UI intents. Returns an unsubscribe function. */
export function onAgentAction(handler: (action: UiAction) => void): () => void {
  const fn = (e: Event) => {
    const parsed = uiActionSchema.safeParse((e as CustomEvent).detail);
    if (parsed.success) handler(parsed.data);
  };
  window.addEventListener(AGENT_ACTION_EVENT, fn);
  return () => window.removeEventListener(AGENT_ACTION_EVENT, fn);
}
