"use client";
/**
 * Single seam between the UI and the voice layer.
 * Uses the real ElevenLabs-backed hook (lib/voice/useHeirloomVoice). In demo (mock data) mode, when no
 * voice service is configured, it falls back to a clearly labelled simulated call so the call screen
 * can still be shown. On the live network an unavailable service falls back to text chat instead.
 */
import type { HeirloomVoice } from "../voice/types";
import { useHeirloomVoice as useRealVoice } from "../voice/useHeirloomVoice";
import { useHeirloomVoice as useSimulatedVoice } from "./mock-voice";

const DEMO = process.env.NEXT_PUBLIC_DATA_MODE !== "chain";

export function useHeirloomVoice(): HeirloomVoice & { simulated?: boolean } {
  const real = useRealVoice();
  const simulated = useSimulatedVoice();
  return DEMO && real.status === "unavailable" ? simulated : real;
}
