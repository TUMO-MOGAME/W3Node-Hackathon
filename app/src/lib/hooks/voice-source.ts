/**
 * Single seam between the UI and the voice layer (ElevenLabs).
 * Points at lib/voice/useHeirloomVoice.ts when it exists; ./mock-voice is a simulated call
 * with the same HeirloomVoice shape so the call screen can be designed and demoed offline.
 */
export { useHeirloomVoice } from "./mock-voice";
