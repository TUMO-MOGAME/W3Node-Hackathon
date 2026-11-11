"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeartHandshake, Lock, Phone, PhoneOff, Power } from "@/components/ui/icons";
import type { LegacyCopy, LegacySafetyCopy } from "@/content/legacy";
import type { EstateSnapshot } from "@/lib/service";
import { useEstate } from "@/lib/hooks/estate";
import { useHeirloomVoice } from "@/lib/voice/useHeirloomVoice";
import { detectDistress, disclosureLine, pronouns } from "@/lib/legacy/prompt";
import { milestonesFor, type LegacyChatReply, type LegacySpeech, type LegacyStatus } from "@/lib/legacy/schema";
import { Button, ButtonLink, Card, Notice } from "@/components/ui/primitives";
import { Chips, Composer, Thinking } from "@/components/agent/chat-parts";
import { fmt } from "@/components/shell/copy";
import { Bubble } from "./bubble";
import { DisclosureLabel, PlayButton, SafetyCard } from "./parts";
import { useLegacyPlayer } from "./use-player";
import { legacyError } from "./use-legacy";

interface Line { id: number; role: "user" | "agent"; text: string; voice?: "parent" | "heirloom"; source?: LegacyChatReply["source"]; speech?: LegacySpeech }
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

export function ChildTalk({ copy, safety, status, snap, reload }: { copy: LegacyCopy; safety: LegacySafetyCopy; status: LegacyStatus; snap: EstateSnapshot; reload: () => Promise<void> }) {
  const c = copy.child;
  const { service, notify } = useEstate();
  const book = status.book;
  const called = book?.calledBy ?? "Dad";
  const p = pronouns(book?.pronoun ?? "he");
  const vars = { called, calledLower: called.toLowerCase(), pronoun: p.subject, possessive: p.possessive };
  const [busy, setBusy] = useState(false);

  if (!status.voice) return <Notice tone="neutral" title={fmt(c.noVoice, vars)} />;
  if (!status.unlocked) {
    return (
      <Notice tone="neutral" icon={<Lock className="size-5" aria-hidden="true" />} title={fmt(c.locked, vars)}>
        <ButtonLink href="/family" small variant="secondary" className="mt-3">{copy.eyebrow}</ButtonLink>
      </Notice>
    );
  }
  if (!status.optedIn) {
    const choose = async (on: boolean) => {
      if (!on) return;
      if (!service) return;
      setBusy(true);
      try { await service.setLegacyOptIn(snap.estate.address, true); await reload(); }
      catch (e) { notify("error", legacyError(e, c.error)); }
      finally { setBusy(false); }
    };
    return (
      <Card className="border-2 border-ink">
        <h2 className="flex items-center gap-2 text-h3"><HeartHandshake className="size-5" aria-hidden="true" />{fmt(c.optIn.title, vars)}</h2>
        <p className="mt-2">{fmt(c.optIn.body, vars)}</p>
        <DisclosureLabel className="mt-3" text={fmt(c.label, { called, date: fmtDate(status.voice.consentedAt) })} simulated={status.voice.simulated} simulatedText={c.labelSimulated} />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button loading={busy} onClick={() => void choose(true)}>{c.optIn.yes}</Button>
          <ButtonLink href="/family" variant="ghost">{c.optIn.notNow}</ButtonLink>
        </div>
      </Card>
    );
  }
  return <Talk copy={copy} safety={safety} status={status} snap={snap} reload={reload} />;
}

function Talk({ copy, safety, status, snap, reload }: { copy: LegacyCopy; safety: LegacySafetyCopy; status: LegacyStatus; snap: EstateSnapshot; reload: () => Promise<void> }) {
  const c = copy.child;
  const { service, notify, session } = useEstate();
  const book = status.book!;
  const voiceInfo = status.voice!;
  const called = book.calledBy;
  const p = pronouns(book.pronoun);
  const vars = { called, calledLower: called.toLowerCase(), pronoun: p.subject, possessive: p.possessive };
  const estate = snap.estate.address;
  const { play, stop, playing } = useLegacyPlayer(book.pronoun);
  const disclosure = disclosureLine(book);
  const [lines, setLines] = useState<Line[]>([{ id: 0, role: "agent", text: disclosure, voice: "heirloom" }]);
  const [pending, setPending] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const disclosed = useRef(false);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);
  const ms = milestonesFor(book, status.childId);
  const adults = snap.estate.verifierNames.join(", ");
  const callVoice = useHeirloomVoice();
  const [callNote, setCallNote] = useState<string | null>(null);
  const live = callVoice.status === "connected" || callVoice.status === "connecting" || callVoice.status === "requesting-mic";

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [lines.length, pending]);
  // Safety also watches the live call's transcript.
  const callDistress = callVoice.transcript.some((l) => l.role === "user" && detectDistress(l.text));

  /** The disclosure is spoken (in Heirloom's voice) before the first thing played in the parent's voice. */
  const say = useCallback(async (id: string, s: LegacySpeech) => {
    if (!disclosed.current) {
      disclosed.current = true;
      await play("disclosure", { text: disclosure, audioUrl: null, simulated: true, voice: "heirloom" });
    }
    await play(id, s);
  }, [play, disclosure]);

  const playMilestone = async (id: string) => {
    if (!service) return;
    try { await say(id, await service.legacySpeak(estate, { milestoneId: id })); }
    catch (e) { notify("error", legacyError(e, c.error)); }
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || !service) return;
    if (detectDistress(t)) setShowSafety(true);
    const history = [...lines.filter((l) => l.id !== 0), { id: nextId.current++, role: "user" as const, text: t }];
    setLines((ls) => [...ls, history[history.length - 1]]);
    setPending(true);
    try {
      const r = await service.legacyChat(estate, history.map((l) => ({ role: l.role, text: l.text })));
      if (r.safety) setShowSafety(true);
      const speech = await service.legacySpeak(estate, { text: r.reply, token: r.speakToken }, r.voice).catch(() => null);
      const id = nextId.current++;
      setLines((ls) => [...ls, { id, role: "agent", text: r.reply, voice: r.voice, source: r.source, speech: speech ?? undefined }]);
      setPending(false);
      if (speech) await (r.voice === "parent" ? say(`l${id}`, speech) : play(`l${id}`, speech));
    } catch (e) {
      setPending(false);
      notify("error", legacyError(e, c.error));
    }
  };

  const startCall = async () => {
    if (!service) return;
    setCallNote(null);
    try {
      const s = await service.legacyCall(estate);
      if (!s) { setCallNote(fmt(c.callUnavailable, vars)); return; }
      stop();
      await callVoice.start({ persona: `beneficiary:${session?.label ?? ""}`, estate, signedUrl: s.signedUrl });
    } catch (e) { setCallNote(legacyError(e, c.error)); }
  };

  const switchOff = async () => {
    if (!service) return;
    stop();
    if (live) await callVoice.stop();
    try { await service.setLegacyOptIn(estate, false); notify("info", c.optIn.offDone); await reload(); }
    catch (e) { notify("error", legacyError(e, c.error)); }
  };

  return (
    <div className="grid gap-5">
      <div className="sticky top-[calc(var(--header-h,3.5rem)+0.25rem)] z-10 -mx-1 rounded-full bg-surface/90 px-1 py-1 backdrop-blur-sm">
        <DisclosureLabel text={fmt(c.label, { called, date: fmtDate(voiceInfo.consentedAt) })} simulated={voiceInfo.simulated} simulatedText={c.labelSimulated} />
      </div>

      {(showSafety || callDistress) && <SafetyCard copy={safety} called={called} adults={adults} />}

      {ms.length > 0 && (
        <Card>
          <h2 className="text-h3">{fmt(c.messages, vars)}</h2>
          <ul className="mt-3 grid gap-2">
            {ms.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-md border border-line p-3">
                <span className="min-w-0 flex-1 font-semibold">{m.title}</span>
                <PlayButton small playing={playing === m.id} onPlay={() => void playMilestone(m.id)} onStop={stop} label={c.play} stopLabel={c.stopPlaying} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h3">{fmt(c.chatTitle, vars)}</h2>
          {live
            ? <Button variant="danger" small onClick={() => void callVoice.stop()}><PhoneOff className="size-4" aria-hidden="true" />{c.callEnd}</Button>
            : <Button variant="secondary" small onClick={() => void startCall()}><Phone className="size-4" aria-hidden="true" />{fmt(c.callLive, vars)}</Button>}
        </div>
        {callNote && <p role="status" className="mt-2 text-small text-ink-2">{callNote}</p>}
        {(live || callVoice.transcript.length > 0) && (
          <ol aria-live="polite" className="mt-3 grid gap-2 rounded-md border border-line p-3 text-small">
            <li className="font-semibold" role="status">{callVoice.status === "connected" ? (callVoice.isSpeaking ? called : c.you) : callVoice.status === "error" ? (callVoice.error ?? c.error) : "…"}</li>
            {callVoice.transcript.map((l, i) => <li key={`${l.ts}-${i}`}><span className="font-semibold">{l.role === "agent" ? called : c.you}:</span> {l.text}</li>)}
          </ol>
        )}
        <ul role="log" aria-live="polite" aria-relevant="additions" className="mt-4 flex flex-col gap-4">
          {lines.map((l) => (
            <Bubble key={l.id} role={l.role} text={l.text} voice={l.voice} source={l.source} copy={copy} called={called}
              action={l.speech ? <PlayButton small playing={playing === `l${l.id}`} onPlay={() => void (l.voice === "parent" ? say(`l${l.id}`, l.speech!) : play(`l${l.id}`, l.speech!))} onStop={stop} label={c.replay} stopLabel={c.stopPlaying} /> : undefined} />
          ))}
          {pending && <Thinking label={fmt(c.thinking, vars)} />}
        </ul>
        {!pending && lines.length < 3 && <div className="mt-4"><Chips items={c.suggestions} onPick={(s) => void send(s)} label={fmt(c.chatTitle, vars)} /></div>}
        <div className="mt-4"><Composer onSend={(t) => void send(t)} disabled={pending} copy={{ placeholder: c.placeholder, inputLabel: fmt(c.inputLabel, vars), send: c.send }} /></div>
        <div ref={end} />
      </Card>

      <Button variant="ghost" className="justify-self-start" onClick={() => void switchOff()}><Power className="size-4" aria-hidden="true" />{c.optIn.off}</Button>
    </div>
  );
}
