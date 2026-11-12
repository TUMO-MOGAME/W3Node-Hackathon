"use client";
/**
 * useHeirloomVoice(): HeirloomVoice (./types.ts) on the ElevenLabs Agents Platform.
 * Uses VoiceConversation from @elevenlabs/react (re-exported @elevenlabs/client) directly, so no provider is
 * needed. Flow: mic permission → GET /api/voice/session (signed URL) → startSession with dynamic variables
 * { persona, estate, page } and client tools that emit UI actions (lib/agent/actions.ts).
 * The ElevenLabs agent calls our orchestrator through its server tool `heirloom_orchestrate`; when
 * the "agent_tool_response_full_payload" client event is enabled, its { specialist, actions } are applied here too.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceConversation } from "@elevenlabs/react";
import type { HeirloomVoice, SpecialistName, VoiceContext, VoiceStatus, VoiceTranscriptLine } from "./types";
import { dispatchAgentAction, uiActionSchema, type UiAction } from "../agent/actions";

const SPECIALISTS: SpecialistName[] = ["Orchestrator", "WillWriter", "DocumentReviewer", "ClaimsGuide", "CarBroker", "EstateGuide", "Compliance", "LegacyCompanion"];

/** Client tools the ElevenLabs agent may call (names must match scripts/elevenlabs-agent.md). */
function clientTools(emit: (a: UiAction) => void) {
  const run = (raw: unknown) => {
    const p = uiActionSchema.safeParse(raw);
    if (!p.success) return `Invalid parameters: ${p.error.issues[0]?.message ?? "unknown"}`;
    emit(p.data);
    return "done";
  };
  return {
    navigate: (p: { path?: string }) => run({ type: "navigate", path: p.path }),
    open_claim_form: (p: { rule?: string; payee?: string; amount?: number }) => run({ type: "openClaimForm", ...p }),
    show_rule: (p: { rule?: string }) => run({ type: "showRule", rule: p.rule }),
    start_upload: (p: { purpose?: string }) => run({ type: "startUpload", purpose: p.purpose }),
  };
}

export function useHeirloomVoice(): HeirloomVoice {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isSpeaking, setSpeaking] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [transcript, setTranscript] = useState<VoiceTranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const conv = useRef<VoiceConversation | null>(null);
  const specialist = useRef<SpecialistName | undefined>(undefined);
  const recent = useRef(new Map<string, number>());
  const raf = useRef<number | null>(null);

  // Dedupe actions that arrive both as a client-tool call and in the server-tool payload.
  const emit = useCallback((a: UiAction) => {
    const k = JSON.stringify(a);
    const now = Date.now();
    if (now - (recent.current.get(k) ?? 0) < 3000) return;
    recent.current.set(k, now);
    dispatchAgentAction(a);
  }, []);

  const stopMeter = () => { if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; };
  const startMeter = useCallback(() => {
    let last = 0;
    const tick = (t: number) => {
      const c = conv.current;
      if (!c) return;
      if (t - last > 66) { // ~15 fps is plenty for an orb
        last = t;
        setInputLevel(Math.min(1, c.getInputVolume()));
        setOutputLevel(Math.min(1, c.getOutputVolume()));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(async () => {
    stopMeter();
    const c = conv.current;
    conv.current = null;
    if (c) await c.endSession().catch(() => undefined);
    setSpeaking(false); setInputLevel(0); setOutputLevel(0);
    setStatus((s) => (s === "error" || s === "unavailable" ? s : "ended"));
  }, []);

  const start = useCallback(async (ctx: VoiceContext) => {
    if (conv.current) return;
    setError(null);
    setTranscript([]);
    specialist.current = undefined;
    try {
      setStatus("requesting-mic");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // permission only; the SDK opens its own stream

      setStatus("connecting");
      let signedUrl = ctx.signedUrl;
      if (!signedUrl) {
        const res = await fetch("/api/voice/session", { cache: "no-store" });
        if (res.status === 503) { setStatus("unavailable"); return; }
        const data = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
        if (!res.ok || !data.signedUrl) throw new Error(data.error ?? "Could not start a voice session.");
        signedUrl = data.signedUrl;
      }
      const legacy = Boolean(ctx.signedUrl);

      conv.current = await VoiceConversation.startSession({
        signedUrl,
        // The legacy agent gets nothing from the client: no tools (no navigation, no claims), no variables.
        ...(legacy ? {} : {
          dynamicVariables: { persona: ctx.persona, persona_name: ctx.persona.split(":")[1]?.split(" ")[0] || "there", estate: ctx.estate ?? "none", page: ctx.page ?? "/", facts: ctx.facts ?? "none" },
          clientTools: clientTools(emit),
        }),
        onConnect: () => { setStatus("connected"); startMeter(); },
        onDisconnect: () => { stopMeter(); conv.current = null; setSpeaking(false); setStatus((s) => (s === "error" ? s : "ended")); },
        onError: (message: string) => { setError(message); setStatus("error"); },
        onModeChange: ({ mode }) => setSpeaking(mode === "speaking"),
        onMessage: ({ message, role }) => {
          if (!message) return;
          setTranscript((t) => [...t, { role, text: message, ts: Date.now(), specialist: role === "agent" ? specialist.current : undefined }]);
        },
        onAgentToolResponse: (p) => {
          if (!("full_tool_result" in p) || !p.full_tool_result) return;
          try {
            const r = JSON.parse(p.full_tool_result) as { specialist?: string; actions?: unknown[] };
            if (r.specialist && (SPECIALISTS as string[]).includes(r.specialist)) specialist.current = r.specialist as SpecialistName;
            for (const a of r.actions ?? []) { const ok = uiActionSchema.safeParse(a); if (ok.success) emit(ok.data); }
          } catch { /* not our tool's JSON */ }
        },
      });
      conv.current.setMicMuted(muted);
    } catch (e) {
      stopMeter();
      conv.current = null;
      const msg = e instanceof Error ? e.message : String(e);
      setError(/denied|NotAllowed|Permission/i.test(msg) ? "Microphone access was blocked. Allow it in your browser to talk to Heirloom." : msg);
      setStatus("error");
    }
  }, [emit, muted, startMeter]);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    conv.current?.setMicMuted(m);
  }, []);

  // Report "unavailable" up front when the server has no ElevenLabs config, so the UI can show text chat.
  useEffect(() => {
    let alive = true;
    fetch("/api/agent", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ voice?: boolean }>)
      .then((d) => { if (alive && d.voice === false) setStatus((s) => (s === "idle" ? "unavailable" : s)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => () => { stopMeter(); void conv.current?.endSession().catch(() => undefined); }, []);

  return { status, isSpeaking, inputLevel, outputLevel, transcript, error, start, stop, setMuted, muted };
}
