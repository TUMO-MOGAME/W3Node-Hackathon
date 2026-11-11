/**
 * Voice call with the Heirloom agent (ElevenLabs Agents Platform, @elevenlabs/react).
 * Implemented by the backend agent in ./useHeirloomVoice.ts; the UI (call sheet, mic button,
 * live transcript, speaking orb) is built by the design agent against this interface.
 *
 * Flow: browser asks mic permission → GET /api/voice/session (server creates an ElevenLabs
 * signed URL / conversation token with ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID) → useConversation
 * starts the session with dynamic variables (persona, estate context). The ElevenLabs agent calls
 * our orchestrator via a server (webhook) tool POST /api/agent/orchestrate, and client tools that
 * drive the UI (e.g. navigate, open the claim form prefilled, show a rule).
 * Without ELEVENLABS_* env the hook reports status "unavailable" and the UI falls back to text chat.
 */
export type VoiceStatus = "idle" | "requesting-mic" | "connecting" | "connected" | "ended" | "error" | "unavailable";

export interface VoiceTranscriptLine {
  role: "user" | "agent";
  text: string;
  ts: number;
  /** Which specialist the orchestrator routed to, when known (e.g. "WillWriter"). */
  specialist?: SpecialistName;
}

export type SpecialistName = "Orchestrator" | "WillWriter" | "DocumentReviewer" | "ClaimsGuide" | "CarBroker" | "EstateGuide" | "Compliance";

export interface VoiceContext {
  persona: string; // e.g. "owner:Thabo Mokoena"
  estate?: string; // estate address
  page?: string;   // current route, lets the agent say "on this screen…"
}

export interface HeirloomVoice {
  status: VoiceStatus;
  isSpeaking: boolean; // agent speaking → drive the orb animation
  /** 0..1 input/output volume for visualisation. */
  inputLevel: number;
  outputLevel: number;
  transcript: VoiceTranscriptLine[];
  error: string | null;
  start(ctx: VoiceContext): Promise<void>;
  stop(): Promise<void>;
  setMuted(muted: boolean): void;
  muted: boolean;
}
