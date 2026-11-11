"use client";
import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { MessageCircle, Mic, MicOff, Phone, PhoneOff, RotateCcw, ShieldCheck } from "lucide-react";
import { useEstate } from "@/lib/hooks/estate";
import { useAssistant } from "@/lib/hooks/use-assistant";
import { useHeirloomVoice } from "@/lib/hooks/voice-source";
import type { HeirloomVoice } from "@/lib/voice/types";
import { Sheet } from "@/components/ui/client";
import { Badge, Button, Notice } from "@/components/ui/primitives";
import { useCopy } from "@/components/shell/copy";
import { ActionButtons, Bubble, Chips, Composer, SpecialistChip, Thinking } from "./chat-parts";

/** "Talk to Heirloom": one sheet, two ways to talk. Chat (text) and Call (voice). */
export function AgentSheet() {
  const { assistant: copy } = useCopy();
  const { agent, openAgent, closeAgent, session, snap } = useEstate();
  const pathname = usePathname();
  const voice = useHeirloomVoice();
  const chat = useAssistant(copy, pathname);
  const live = voice.status === "connected" || voice.status === "connecting" || voice.status === "requesting-mic";

  const close = useCallback(() => {
    if (live) void voice.stop();
    closeAgent();
  }, [live, voice, closeAgent]);

  const startCall = useCallback(() => {
    void voice.start({
      persona: session ? `${session.role}:${session.label}` : "guest",
      estate: snap?.estate.address,
      page: pathname,
    });
  }, [voice, session, snap, pathname]);

  const tabs = (
    <div role="tablist" aria-label={copy.sheet.title} className="flex shrink-0 rounded-full bg-surface-2 p-1">
      {(["chat", "call"] as const).map((m) => (
        <button
          key={m} type="button" role="tab" id={`agent-tab-${m}`} aria-selected={agent === m} aria-controls="agent-panel"
          onClick={() => openAgent(m)}
          className={clsx("inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-small font-semibold transition-colors", agent === m ? "bg-surface text-ink shadow-card" : "text-ink-2")}
        >
          {m === "chat" ? <MessageCircle className="size-4" aria-hidden="true" /> : <Phone className="size-4" aria-hidden="true" />}
          {m === "chat" ? copy.sheet.tabChat : copy.sheet.tabCall}
          {m === "call" && live && <span className="size-2 animate-pulse-soft rounded-full bg-danger" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );

  return (
    <Sheet open={agent !== null} onClose={close} title={copy.sheet.title} closeLabel={copy.sheet.close} tall headerExtra={tabs}>
      <div id="agent-panel" role="tabpanel" aria-labelledby={`agent-tab-${agent ?? "chat"}`} className="flex min-h-full flex-col">
        {agent === "call"
          ? <CallView voice={voice} onStart={startCall} onChat={() => openAgent("chat")} />
          : <ChatView chat={chat} onNavigate={closeAgent} />}
      </div>
    </Sheet>
  );
}

/* ---------- Chat ---------- */

function ChatView({ chat, onNavigate }: { chat: ReturnType<typeof useAssistant>; onNavigate: () => void }) {
  const { assistant: copy } = useCopy();
  const { role } = useEstate();
  const { messages, pending, send, reset } = chat;
  const end = useRef<HTMLDivElement>(null);
  const scroll = useCallback(() => end.current?.scrollIntoView({ block: "end" }), []);
  useEffect(() => { scroll(); }, [messages.length, pending, scroll]);
  const suggestions = copy.suggestions[role === "agent" || !role ? "none" : role];
  const last = messages[messages.length - 1];

  return (
    <>
      <div className="min-h-0 flex-1">
        <ul role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-4">
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} text={m.text} specialist={m.specialist} fresh={m.fresh} copy={copy} onTick={scroll} onTyped={scroll}>
              {m.actions && m.id === last?.id && <ActionButtons actions={m.actions} copy={copy} onDone={onNavigate} />}
            </Bubble>
          ))}
          {pending && <Thinking label={copy.chat.thinking} />}
        </ul>
        {!pending && last?.role === "agent" && (
          <div className="mt-4 pl-9">
            <Chips items={messages.length <= 1 ? suggestions : suggestions.filter((s) => !messages.some((m) => m.text === s)).slice(0, 2)} onPick={send} label={copy.chat.suggestionsLabel} />
          </div>
        )}
        <div ref={end} className="h-4" />
      </div>
      <div className="sticky bottom-0 -mx-4 bg-surface px-4 pb-1 pt-2 sm:-mx-5 sm:px-5">
        <Composer onSend={send} disabled={pending} copy={copy.chat} />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.75rem] text-ink-2">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />{copy.chat.disclaimer}</span>
          {messages.length > 1 && (
            <button type="button" onClick={reset} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 font-semibold hover:bg-surface-2">
              <RotateCcw className="size-3.5" aria-hidden="true" />{copy.chat.newChat}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Call ---------- */

function Orb({ voice, label }: { voice: HeirloomVoice; label: string }) {
  const reduced = useReducedMotion();
  const connected = voice.status === "connected";
  const waiting = voice.status === "connecting" || voice.status === "requesting-mic";
  const out = connected ? voice.outputLevel : 0;
  const inp = connected && !voice.muted ? voice.inputLevel : 0;
  const level = Math.max(out, inp);
  const userTalking = inp > out && inp > 0.08;
  const spring = { type: "spring" as const, stiffness: 260, damping: 18, mass: 0.6 };
  const tint = userTalking ? "var(--brass)" : "var(--accent)";
  return (
    <div className="relative mx-auto grid size-56 place-items-center" role="img" aria-label={label}>
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${tint} 32%, transparent) 0%, transparent 68%)` }}
        animate={reduced ? { opacity: level > 0.08 ? 1 : 0.5 } : { scale: 0.8 + level * 0.45, opacity: 0.55 + level * 0.45 }}
        transition={spring}
      />
      <motion.span
        aria-hidden="true"
        className="absolute inset-7 rounded-full border-2"
        style={{ borderColor: `color-mix(in srgb, ${tint} 45%, transparent)` }}
        animate={reduced ? { opacity: level > 0.08 ? 1 : 0.4 } : { scale: 1 + level * 0.2 }}
        transition={spring}
      />
      <motion.span
        aria-hidden="true"
        className={clsx("relative size-32 rounded-full shadow-float", (waiting || (connected && level < 0.05)) && !reduced && "animate-[orb-breathe_2.6s_ease-in-out_infinite]", waiting && "opacity-70")}
        style={{
          background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--surface) 55%, ${tint}) 0%, ${tint} 46%, color-mix(in srgb, ${tint} 62%, black) 100%)`,
        }}
        animate={reduced ? {} : { scale: 1 + (voice.isSpeaking ? out : inp) * 0.14 }}
        transition={spring}
      />
    </div>
  );
}

function CallView({ voice, onStart, onChat }: { voice: HeirloomVoice & { simulated?: boolean }; onStart: () => void; onChat: () => void }) {
  const { assistant: copy } = useCopy();
  const v = copy.voice;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [voice.transcript.length]);
  const s = voice.status;

  if (s === "unavailable") {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4 py-6">
        <Notice tone="warn" icon={<PhoneOff className="size-5" aria-hidden="true" />} title={v.unavailableTitle}>{v.unavailableBody}</Notice>
        <Button onClick={onChat} block><MessageCircle className="size-5" aria-hidden="true" />{v.useChat}</Button>
      </div>
    );
  }

  if (s === "idle") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4 text-center">
        <Orb voice={voice} label={v.orbLabel} />
        <div>
          <h3 className="text-h3">{v.explainerTitle}</h3>
          <p className="mx-auto mt-2 max-w-sm text-ink-2">{v.explainerBody}</p>
        </div>
        <Notice icon={<Mic className="size-5" aria-hidden="true" />} title={v.micTitle} className="w-full text-left">{v.micBody}</Notice>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={onStart} block><Phone className="size-5" aria-hidden="true" />{v.start}</Button>
          <Button variant="ghost" onClick={onChat} block>{v.preferChat}</Button>
        </div>
      </div>
    );
  }

  const statusText =
    s === "requesting-mic" ? v.requestingMic
      : s === "connecting" ? v.connecting
        : s === "ended" ? v.endedTitle
          : s === "error" ? v.errorTitle
            : voice.isSpeaking ? v.speaking : voice.muted ? v.mutedState : v.listening;
  const lastAgent = [...voice.transcript].reverse().find((l) => l.role === "agent");

  return (
    <div className="flex flex-1 flex-col">
      <div className="shrink-0 pt-1 text-center">
        {s !== "ended" && s !== "error" && <Orb voice={voice} label={v.orbLabel} />}
        <div className="mt-1 flex flex-col items-center gap-1.5">
          <p role="status" aria-live="polite" className="text-lead font-semibold">{statusText}</p>
          <div className="flex min-h-6 flex-wrap items-center justify-center gap-2">
            {s === "connected" && lastAgent?.specialist && lastAgent.specialist !== "Orchestrator" && <SpecialistChip name={lastAgent.specialist} copy={copy} />}
            {voice.simulated && <Badge tone="warn">{v.simulated}</Badge>}
          </div>
        </div>
        {s === "ended" && <p className="mt-1 text-small text-ink-2">{v.endedBody}</p>}
        {s === "error" && <p role="alert" className="mx-auto mt-1 max-w-sm text-small text-ink-2">{voice.error ?? v.errorBody}</p>}
      </div>

      <section aria-label={v.transcript} className="mt-4 min-h-24 flex-1">
        <h3 className="mb-2 text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{v.transcript}</h3>
        {voice.transcript.length === 0
          ? <p className="text-small text-ink-2">{v.transcriptEmpty}</p>
          : (
            <ol role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-3">
              {voice.transcript.map((l, i) => (
                <motion.li key={`${l.ts}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <p className="mb-0.5 flex items-center gap-2 text-small font-semibold">
                    <span className={l.role === "agent" ? "text-accent" : "text-brass"}>{l.role === "agent" ? v.agent : v.you}</span>
                    {l.role === "agent" && l.specialist && l.specialist !== "Orchestrator" && <SpecialistChip name={l.specialist} copy={copy} />}
                  </p>
                  <p className={clsx("rounded-md px-3 py-2", l.role === "agent" ? "bg-surface-2/70" : "border border-line")}>{l.text}</p>
                </motion.li>
              ))}
            </ol>
          )}
        <div ref={end} className="h-3" />
      </section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-center gap-4 bg-surface px-4 pb-1 pt-3 sm:-mx-5">
        {s === "ended" || s === "error" ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button onClick={onStart} className="flex-1"><Phone className="size-5" aria-hidden="true" />{s === "error" ? v.retry : v.again}</Button>
            <Button variant="secondary" onClick={onChat} className="flex-1"><MessageCircle className="size-5" aria-hidden="true" />{v.useChat}</Button>
          </div>
        ) : (
          <>
            <button
              type="button" aria-pressed={voice.muted} aria-label={voice.muted ? v.unmute : v.mute} disabled={s !== "connected"}
              onClick={() => voice.setMuted(!voice.muted)}
              className={clsx("grid size-14 place-items-center rounded-full border-2 transition-colors disabled:opacity-40", voice.muted ? "border-brass bg-brass-soft text-brass" : "border-line-strong bg-surface text-ink hover:bg-surface-2")}
            >
              {voice.muted ? <MicOff className="size-6" aria-hidden="true" /> : <Mic className="size-6" aria-hidden="true" />}
            </button>
            <button
              type="button" aria-label={v.end} onClick={() => void voice.stop()}
              className="grid h-14 w-24 place-items-center rounded-full bg-danger text-surface shadow-raised transition-transform active:scale-95"
            >
              <PhoneOff className="size-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
