"use client";
/**
 * Plays a LegacySpeech: rendered audio (the real cloned voice) through an <audio> element, or, when simulated,
 * the browser's speech synthesis. The parent and Heirloom never share a voice: Heirloom (disclosures, safety,
 * refusals) uses a different system voice and normal pitch, so a child can hear who is speaking.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LegacySpeech } from "@/lib/legacy/schema";

function pickVoice(kind: LegacySpeech["voice"], pronoun: "he" | "she" | "they"): SpeechSynthesisVoice | null {
  const all = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")) : [];
  if (!all.length) return null;
  const za = all.filter((v) => /en[-_]za/i.test(v.lang));
  const male = /male|david|daniel|george|james|guy|mark|thomas|fred|ryan|liam/i;
  const female = /female|zira|susan|hazel|libby|sonia|karen|samantha|victoria|leah|aria|jenny/i;
  if (kind === "heirloom") return all.find((v) => /en[-_](us|gb)/i.test(v.lang) && female.test(v.name)) ?? all[all.length - 1];
  const pool = za.length ? za : all;
  const want = pronoun === "she" ? female : male;
  return pool.find((v) => want.test(v.name)) ?? pool[0];
}

export function useLegacyPlayer(pronoun: "he" | "she" | "they" = "he") {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<string[]>([]);

  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setPlaying(null);
  }, []);

  useEffect(() => () => {
    stop();
    urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, [stop]);

  /** Plays `speech`; `id` lets the UI show which item is playing. Resolves when playback ends. */
  const play = useCallback((id: string, speech: LegacySpeech) => new Promise<void>((resolve) => {
    stop();
    setPlaying(id);
    const end = () => { setPlaying((p) => (p === id ? null : p)); resolve(); };
    if (speech.audioUrl) {
      urls.current.push(speech.audioUrl);
      const a = new Audio(speech.audioUrl);
      audio.current = a;
      a.onended = end; a.onerror = end;
      void a.play().catch(end);
      return;
    }
    if (typeof speechSynthesis === "undefined") { end(); return; }
    const u = new SpeechSynthesisUtterance(speech.text);
    const v = pickVoice(speech.voice, pronoun);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-ZA";
    u.rate = speech.voice === "parent" ? 0.92 : 1;
    u.pitch = speech.voice === "parent" ? (pronoun === "she" ? 1 : 0.8) : 1.05;
    u.onend = end; u.onerror = end;
    speechSynthesis.speak(u);
  }), [pronoun, stop]);

  return { play, stop, playing };
}
