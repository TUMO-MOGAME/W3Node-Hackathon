import type { SpecialistName } from "../voice/types";

/** UI actions the orchestrator may attach to a reply. Rendered as buttons under the message. */
export type AgentAction =
  | { type: "navigate"; to: string }
  | { type: "openClaimForm"; rule?: string; payee?: string; amount?: number }
  | { type: "showRule"; rule: string }
  | { type: "startUpload"; purpose: "death" | "claim" | "hardship" };

export interface OrchestratorReply { specialist: SpecialistName; reply: string; actions: AgentAction[] }

export interface AssistantMessage {
  id: number;
  role: "user" | "agent";
  text: string;
  specialist?: SpecialistName;
  actions?: AgentAction[];
  /** True while this is the newest agent message, so it types itself out once. */
  fresh?: boolean;
}

/** The agent may use its own route names; map them onto the app's routes. */
const ROUTES: Record<string, string> = { "/owner": "/estate", "/verifier": "/inbox", "/buyer": "/car", "/audit": "/estate?proof=1", "/dashboard": "/estate", "/plan": "/will", "/timeline": "/family", "/home": "/estate" };
export function mapAgentPath(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return ROUTES[clean] ?? path;
}

const SPECIALISTS: SpecialistName[] = ["Orchestrator", "WillWriter", "DocumentReviewer", "ClaimsGuide", "CarBroker", "EstateGuide", "Compliance", "LegacyCompanion"];

/** Accepts whatever shape the server sends ({type,...} or {name, params}) and keeps only actions we can render. */
export function normaliseReply(raw: unknown): OrchestratorReply | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const reply = typeof r.reply === "string" ? r.reply : typeof r.text === "string" ? r.text : null;
  if (!reply) return null;
  const specialist = SPECIALISTS.includes(r.specialist as SpecialistName) ? (r.specialist as SpecialistName) : "Orchestrator";
  const actions: AgentAction[] = [];
  for (const item of Array.isArray(r.actions) ? r.actions : []) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const type = String(a.type ?? a.name ?? a.action ?? a.kind ?? "");
    const p = { ...a, ...((a.params ?? a.args ?? a.payload ?? {}) as Record<string, unknown>) };
    const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    if (type === "navigate") {
      const to = str(p.to) ?? str(p.path) ?? str(p.href) ?? str(p.route);
      if (to && to.startsWith("/")) actions.push({ type, to: mapAgentPath(to) });
    } else if (type === "openClaimForm") {
      const amount = typeof p.amount === "number" ? p.amount : typeof p.amountUsdt === "number" ? p.amountUsdt : Number(p.amount) || undefined;
      actions.push({ type, rule: str(p.rule), payee: str(p.payee), amount });
    } else if (type === "showRule") {
      const rule = str(p.rule) ?? str(p.address);
      if (rule) actions.push({ type, rule });
    } else if (type === "startUpload") {
      const purpose = str(p.purpose);
      if (purpose === "death" || purpose === "claim" || purpose === "hardship") actions.push({ type, purpose });
    }
  }
  return { specialist, reply, actions };
}
