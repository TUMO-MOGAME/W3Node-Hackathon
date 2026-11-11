"use client";
/**
 * Simulated voice call with the same HeirloomVoice shape as lib/voice/useHeirloomVoice.ts.
 * No audio is captured or played: it plays a short scripted exchange so the call screen
 * (orb, transcript, controls, states) can be designed and demoed without a voice service.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { assistant } from "@/content/assistant";
import type { HeirloomVoice, SpecialistName, VoiceStatus, VoiceTranscriptLine } from "../voice/types";

export function useHeirloomVoice(): HeirloomVoice & { simulated?: boolean } {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isSpeaking, setSpeaking] = useState(false);
  const [inputLevel, setIn] = useState(0);
  const [outputLevel, setOut] = useState(0);
  const [transcript, setTranscript] = useState<VoiceTranscriptLine[]>([]);
  const [muted, setMutedState] = useState(false);
  const timers = useRef<number[]>([]);
  const talking = useRef<"user" | "agent" | null>(null);
  const mutedRef = useRef(false);

  const clear = useCallback(() => {
    timers.current.forEach((t) => { window.clearTimeout(t); window.clearInterval(t); });
    timers.current = [];
    talking.current = null;
    setSpeaking(false); setIn(0); setOut(0);
  }, []);
  useEffect(() => clear, [clear]);

  const start = useCallback(async () => {
    clear();
    setTranscript([]);
    setStatus("requesting-mic");
    const at = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
    at(700, () => setStatus("connecting"));
    at(1700, () => {
      setStatus("connected");
      timers.current.push(window.setInterval(() => {
        const who = talking.current;
        const level = 0.25 + Math.random() * 0.7;
        setOut(who === "agent" ? level : 0);
        setIn(who === "user" && !mutedRef.current ? level : 0);
      }, 110));
      let t = 500;
      for (const line of assistant.voicePreview) {
        const dur = 900 + line.text.length * 42;
        at(t, () => {
          talking.current = line.role;
          setSpeaking(line.role === "agent");
          setTranscript((prev) => [...prev, { role: line.role, text: line.text, ts: Date.now(), specialist: line.specialist as SpecialistName | undefined }]);
        });
        at(t + dur, () => { talking.current = null; setSpeaking(false); });
        t += dur + 500;
      }
    });
  }, [clear]);

  const stop = useCallback(async () => { clear(); setStatus("ended"); }, [clear]);
  const setMuted = useCallback((m: boolean) => { mutedRef.current = m; setMutedState(m); }, []);

  return { status, isSpeaking, inputLevel, outputLevel, transcript, error: null, start, stop, setMuted, muted, simulated: true };
}
