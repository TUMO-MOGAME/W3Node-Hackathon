"use client";
import clsx from "clsx";
import { HeartHandshake, Pause, Phone, Play, ShieldCheck } from "lucide-react";
import type { LegacySafetyCopy } from "@/content/legacy";
import { fmt } from "@/components/shell/copy";

/** Persistent "AI voice" label (rule 3). Always visible while the legacy voice is on screen. */
export function DisclosureLabel({ text, simulated, simulatedText, className }: { text: string; simulated: boolean; simulatedText: string; className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 text-small font-semibold text-accent">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />{text}
      </span>
      {simulated && <span className="inline-flex min-h-7 items-center rounded-full bg-brass-soft px-3 text-small font-semibold text-brass">{simulatedText}</span>}
    </div>
  );
}

/** Helplines shown when a child seems distressed (rule 5). Always in Heirloom's voice, never the parent's. */
export function SafetyCard({ copy, called, adults }: { copy: LegacySafetyCopy; called: string; adults: string }) {
  return (
    <section role="alert" aria-labelledby="legacy-safety" className="rounded-lg border-2 border-danger/50 bg-danger-soft p-4">
      <h2 id="legacy-safety" className="flex items-center gap-2 text-h3"><HeartHandshake className="size-5 shrink-0 text-danger" aria-hidden="true" />{copy.title}</h2>
      <p className="mt-1 text-small text-ink-2">{fmt(copy.intro, { called })}</p>
      <p className="mt-2">{copy.body}</p>
      <ul className="mt-3 grid gap-2">
        {copy.lines.map((l) => (
          <li key={l.tel}>
            <a href={`tel:${l.tel}`} className="flex min-h-12 items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 hover:bg-surface-2">
              <Phone className="size-5 shrink-0 text-danger" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{l.name}</span>
                <span className="block text-small text-ink-2">{l.note}</span>
              </span>
              <span className="font-mono font-semibold tabular-nums">{l.number}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-small">{fmt(copy.adult, { adults })}</p>
      <p className="mt-1 text-small text-ink-2">{copy.website}</p>
    </section>
  );
}

export function PlayButton({ playing, onPlay, onStop, label, stopLabel, disabled, small }: { playing: boolean; onPlay: () => void; onStop: () => void; label: string; stopLabel: string; disabled?: boolean; small?: boolean }) {
  return (
    <button
      type="button" disabled={disabled} onClick={playing ? onStop : onPlay} aria-pressed={playing}
      className={clsx("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-50", small ? "px-3.5 text-small" : "px-5", playing ? "bg-brass text-surface" : "bg-accent text-accent-ink hover:bg-accent-hover")}
    >
      {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
      {playing ? stopLabel : label}
    </button>
  );
}

/** Small live microphone level bar. */
export function LevelMeter({ level, label }: { level: number; label: string }) {
  const bars = 12;
  const lit = Math.round(Math.min(1, level) * bars);
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="flex h-6 items-end gap-0.5">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={clsx("w-1.5 rounded-sm transition-[height,background-color] duration-75", i < lit ? (i > 9 ? "bg-danger" : "bg-accent") : "bg-line")} style={{ height: `${30 + (i / bars) * 70}%` }} />
      ))}
    </div>
  );
}
