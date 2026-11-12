/**
 * ElevenLabs' expressive voices take tone tags in the agent's text ("[happy]", "[softly]", "[short pause]").
 * They change how the line sounds and must not show in the on-screen transcript.
 */
// A tag plus any punctuation the model puts straight after it ("[Understood]. I'm checking…").
const VOICE_TAG = /\[[a-z][a-z' -]{0,30}\][.,!:;]?\s*/gi;

export function stripVoiceTags(text: string): string {
  return text.replace(VOICE_TAG, "").replace(/\s{2,}/g, " ").trim();
}
