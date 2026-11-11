"use client";
/**
 * Microphone recorder for the legacy voice: MediaRecorder (WebM/Opus in Chrome/Edge/Firefox, MP4/AAC in Safari)
 * with a live level meter from an AnalyserNode. 64 kbps keeps ~2 minutes of samples under the 4 MB upload limit.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", "audio/mpeg"];
export const MAX_RECORD_SECS = 60;

export function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
}

export type RecorderState = "idle" | "starting" | "recording" | "error" | "unsupported";

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<"blocked" | "unsupported" | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const resolve = useRef<((b: { blob: Blob; secs: number } | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (timer.current !== null) window.clearInterval(timer.current);
    raf.current = null; timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => {
    if (rec.current?.state === "recording") rec.current.stop();
    cleanup();
  }, [cleanup]);

  /** Starts recording; the returned promise resolves with the audio when stop() is called (or at the time limit). */
  const start = useCallback(async (): Promise<{ blob: Blob; secs: number } | null> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported"); setError("unsupported"); return null;
    }
    setError(null); setState("starting"); setSecs(0);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      setState("error"); setError("blocked"); return null;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream.current, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 64_000 });
    rec.current = r;
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<{ blob: Blob; secs: number } | null>((res) => { resolve.current = res; });
    const began = Date.now();
    r.onstop = () => {
      cleanup();
      setState("idle");
      const type = (r.mimeType || mime || "audio/webm").split(";")[0];
      resolve.current?.(chunks.length ? { blob: new Blob(chunks, { type }), secs: Math.max(1, Math.round((Date.now() - began) / 1000)) } : null);
      resolve.current = null;
    };

    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx.current = new AC();
        const an = ctx.current.createAnalyser();
        an.fftSize = 512;
        ctx.current.createMediaStreamSource(stream.current).connect(an);
        const buf = new Uint8Array(an.fftSize);
        let last = 0;
        const tick = (t: number) => {
          if (t - last > 66) {
            last = t;
            an.getByteTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
            setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2));
          }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      }
    } catch { /* the meter is optional */ }

    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSecs(s);
      if (s >= MAX_RECORD_SECS && r.state === "recording") r.stop();
    }, 250);
    r.start(1000);
    setState("recording");
    return done;
  }, [cleanup]);

  const stop = useCallback(() => { if (rec.current?.state === "recording") rec.current.stop(); }, []);

  return { state, level, secs, error, start, stop };
}
