/**
 * ElevenLabs' expressive voices take tone tags in the agent's text ("[happy]", "[softly]", "[short pause]").
 * They change how the line sounds and must not show in the on-screen transcript.
 */
const VOICE_TAG = /\[[a-z][a-z' -]{0,30}\]\s*/gi;

export function stripVoiceTags(text: string): string {
  return text.replace(VOICE_TAG, "").replace(/\s{2,}/g, " ").trim();
}
