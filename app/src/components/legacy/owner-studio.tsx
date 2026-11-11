"use client";
import { useId, useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import { Check, Mic, Plus, RotateCcw, Square, Trash2, Volume2 } from "lucide-react";
import type { LegacyCopy } from "@/content/legacy";
import type { EstateSnapshot } from "@/lib/service";
import { useEstate } from "@/lib/hooks/estate";
import {
  consentLine, legacyBookSchema, MIN_SAMPLES, MILESTONE_KINDS, GUIDANCE_TOPICS,
  type LegacyBook, type LegacySpeech, type LegacyStatus, type Milestone,
} from "@/lib/legacy/schema";
import { Button, Card, Consent, Field, inputClass, Notice } from "@/components/ui/primitives";
import { fmt } from "@/components/shell/copy";
import { Bubble } from "./bubble";
import { DisclosureLabel, LevelMeter, PlayButton } from "./parts";
import { useRecorder } from "./use-recorder";
import { useLegacyPlayer } from "./use-player";
import { legacyError } from "./use-legacy";

type Copy = LegacyCopy;
interface Take { blob: Blob; secs: number; url: string }

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

export function OwnerStudio({ copy, status, snap, reload }: { copy: Copy; status: LegacyStatus; snap: EstateSnapshot; reload: () => Promise<void> }) {
  const o = copy.owner;
  const active = snap.estate.status === "Active";
  const [recording, setRecording] = useState(false);
  const voice = recording ? null : status.voice;
  const step = !voice ? 0 : 3;

  return (
    <div className="grid gap-5">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-small" aria-label={o.title}>
        {o.steps.map((name, i) => {
          const done = voice ? i <= 2 : false;
          return (
            <li key={name} className={clsx("inline-flex items-center gap-1.5", done ? "text-ok" : i === step ? "font-semibold text-ink" : "text-ink-2")}>
              <span className={clsx("grid size-6 place-items-center rounded-full border text-[0.75rem] font-bold", done ? "border-ok bg-ok-soft" : "border-line-strong")} aria-hidden="true">
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              {name}
            </li>
          );
        })}
      </ol>

      <Card>
        <h2 className="text-h3">{o.promise.title}</h2>
        <ul className="mt-2 grid gap-1.5 text-small">
          {o.promise.items.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />{t}</li>)}
        </ul>
      </Card>

      {!voice ? (
        active ? <CreateVoice copy={copy} ownerName={snap.estate.ownerName} onDone={async () => { setRecording(false); await reload(); }} />
          : <Notice tone="warn" title={o.voice.none}><p>{o.voice.sealed}</p></Notice>
      ) : (
        <VoiceCard copy={copy} status={status} canChange={active} onRerecord={() => setRecording(true)} reload={reload} />
      )}

      {status.book && <BookEditor copy={copy} initial={status.book} readOnly={!active} reload={reload} />}
      {status.book && voice && <Preview copy={copy} book={status.book} />}
    </div>
  );
}

/* ---------- consent + recording ---------- */

function CreateVoice({ copy, ownerName, onDone }: { copy: Copy; ownerName: string; onDone: () => Promise<void> }) {
  const o = copy.owner;
  const { service, snap, notify } = useEstate();
  const rec = useRecorder();
  const nameId = useId();
  const [name, setName] = useState(ownerName);
  const [tick, setTick] = useState(false);
  const [consent, setConsent] = useState<Take | null>(null);
  const [takes, setTakes] = useState<(Take | null)[]>(() => o.record.prompts.map(() => null));
  const [active, setActive] = useState<number | "consent" | null>(null);
  const [phase, setPhase] = useState<"consent" | "record">("consent");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { play, stop, playing } = useLegacyPlayer();
  const line = consentLine(name || "…");

  const record = async (slot: number | "consent") => {
    if (rec.state === "recording") { rec.stop(); return; }
    setError(null); setActive(slot);
    const got = await rec.start();
    setActive(null);
    if (!got) return;
    const take: Take = { blob: got.blob, secs: got.secs, url: URL.createObjectURL(got.blob) };
    if (slot === "consent") setConsent(take);
    else setTakes((t) => t.map((x, i) => (i === slot ? take : x)));
  };
  const listen = (id: string, t: Take) => void play(id, { text: "", audioUrl: t.url, simulated: false, voice: "parent" });

  const toRecord = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(o.consent.needName);
    if (!consent) return setError(o.consent.needRecording);
    if (!tick) return setError(o.consent.needTick);
    setError(null); setPhase("record");
  };

  const recorded = takes.filter(Boolean) as Take[];
  const create = async () => {
    if (!service || !snap || !consent) return;
    setBusy(true); setError(null);
    try {
      await service.createLegacyVoice(snap.estate.address, { ownerName: name.trim(), consentText: consentLine(name), consentAccepted: tick, consent: consent.blob, samples: recorded.map((t) => t.blob) });
      notify("ok", o.voice.createdToast);
      await onDone();
    } catch (e) {
      setError(legacyError(e, copy.child.error));
    } finally { setBusy(false); }
  };

  const recBtn = (slot: number | "consent", has: boolean) => {
    const live = rec.state === "recording" && active === slot;
    return (
      <Button variant={live ? "danger" : has ? "secondary" : "primary"} small disabled={(rec.state === "recording" && !live) || busy} onClick={() => void record(slot)}>
        {live ? <Square className="size-4" aria-hidden="true" /> : has ? <RotateCcw className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
        {live ? o.record.stop : has ? o.record.again : slot === "consent" ? o.consent.record : o.record.start}
      </Button>
    );
  };
  const live = (slot: number | "consent") => rec.state === "recording" && active === slot && (
    <div className="mt-2 flex items-center gap-3" role="status">
      <span className="size-2.5 animate-pulse-soft rounded-full bg-danger" aria-hidden="true" />
      <span className="text-small font-semibold tabular-nums">{fmt(o.record.recording, { secs: rec.secs })}</span>
      <LevelMeter level={rec.level} label={o.record.level} />
    </div>
  );

  const micError = rec.error === "blocked" ? o.record.micBlocked : rec.error === "unsupported" ? o.record.unsupported : null;

  if (phase === "consent") {
    return (
      <Card>
        <h2 className="text-h3">{o.consent.title}</h2>
        <p className="mt-1 text-ink-2">{o.consent.body}</p>
        <form onSubmit={toRecord} noValidate className="mt-4 grid gap-4">
          <Field label={o.consent.nameLabel} htmlFor={nameId} hint={o.consent.nameHint}>
            <input id={nameId} className={inputClass} value={name} autoComplete="name" onChange={(e) => { setName(e.target.value); setConsent(null); }} />
          </Field>
          <figure className="rounded-md border border-accent/30 bg-accent-soft p-4">
            <figcaption className="text-small font-semibold text-accent">{o.consent.lineLabel}</figcaption>
            <blockquote className="mt-1 font-display text-lead">“{line}”</blockquote>
          </figure>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {recBtn("consent", !!consent)}
              {consent && <PlayButton small playing={playing === "consent"} onPlay={() => listen("consent", consent)} onStop={stop} label={o.record.play} stopLabel={o.record.stop} />}
              {consent && <span className="text-small text-ok">{fmt(o.record.recorded, { secs: consent.secs })}</span>}
            </div>
            {live("consent")}
          </div>
          <Consent id="legacy-consent" checked={tick} onChange={(v) => { setTick(v); setError(null); }} copy={o.consent.checkbox} />
          {(error || micError) && <p role="alert" className="text-small font-medium text-danger">{error ?? micError}</p>}
          <Button type="submit" disabled={rec.state === "recording"}>{o.consent.continue}</Button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-h3">{o.record.title}</h2>
      <p className="mt-1 text-ink-2">{o.record.body}</p>
      <p className="mt-2 text-small font-semibold">{fmt(o.record.minNote, { n: MIN_SAMPLES })} · {fmt(o.record.count, { n: recorded.length, total: takes.length })}</p>
      <ol className="mt-4 grid gap-3">
        {o.record.prompts.map((p, i) => {
          const t = takes[i];
          return (
            <li key={p.title} className={clsx("rounded-md border p-3.5", t ? "border-ok/40 bg-ok-soft/40" : "border-line")}>
              <p className="font-semibold">{i + 1}. {p.title}</p>
              <p className="mt-0.5 text-small text-ink-2">{p.text}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {recBtn(i, !!t)}
                {t && <PlayButton small playing={playing === `t${i}`} onPlay={() => listen(`t${i}`, t)} onStop={stop} label={o.record.play} stopLabel={o.record.stop} />}
                <span className={clsx("text-small", t ? "text-ok" : "text-ink-2")}>{t ? fmt(o.record.recorded, { secs: t.secs }) : o.record.notRecorded}</span>
              </div>
              {live(i)}
            </li>
          );
        })}
      </ol>
      {(error || micError) && <p role="alert" className="mt-3 text-small font-medium text-danger">{error ?? micError}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" loading={busy} disabled={recorded.length < MIN_SAMPLES || rec.state === "recording"} onClick={() => void create()}>
          {busy ? o.record.creating : o.record.create}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setPhase("consent")}>{o.consent.title}</Button>
      </div>
    </Card>
  );
}

/* ---------- the voice ---------- */

function VoiceCard({ copy, status, canChange, onRerecord, reload }: { copy: Copy; status: LegacyStatus; canChange: boolean; onRerecord: () => void; reload: () => Promise<void> }) {
  const o = copy.owner.voice;
  const { service, snap, notify } = useEstate();
  const v = status.voice!;
  const { play, stop, playing } = useLegacyPlayer(status.book?.pronoun);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"hear" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hear = async () => {
    if (!service || !snap) return;
    setBusy("hear"); setError(null);
    try { const s = await service.legacySpeak(snap.estate.address, { text: o.sample }); setBusy(null); await play("sample", s); }
    catch (e) { setError(legacyError(e, copy.child.error)); setBusy(null); }
  };
  const remove = async () => {
    if (!service || !snap) return;
    setBusy("delete"); setError(null);
    try { await service.deleteLegacyVoice(snap.estate.address); notify("ok", o.deleted); setConfirm(false); await reload(); }
    catch (e) { setError(legacyError(e, copy.child.error)); }
    finally { setBusy(null); }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-h3"><Volume2 className="size-5 text-accent" aria-hidden="true" />{o.title}</h2>
          <p className="mt-1 text-small text-ink-2">{fmt(o.created, { date: fmtDate(v.consentedAt) })} · {fmt(o.samples, { n: v.samples })}</p>
        </div>
        <PlayButton playing={playing === "sample"} onPlay={() => void hear()} onStop={stop} label={o.hear} stopLabel={copy.owner.record.stop} disabled={busy === "hear"} />
      </div>
      <DisclosureLabel className="mt-3" text={fmt(copy.child.label, { called: status.book?.calledBy ?? "Dad", date: fmtDate(v.consentedAt) })} simulated={v.simulated} simulatedText={copy.child.labelSimulated} />
      {v.simulated && <p className="mt-2 text-small text-ink-2">{o.simulated}</p>}
      {v.needsVerification && <Notice tone="warn" className="mt-3"><p>{o.verification}</p></Notice>}
      {!v.simulated && <p className="mt-2 text-small text-ink-2">{v.liveCall ? o.live : o.liveOff}</p>}
      {error && <p role="alert" className="mt-2 text-small font-medium text-danger">{error}</p>}
      {canChange && (
        confirm ? (
          <Notice tone="danger" className="mt-4" title={o.delete}>
            <p>{o.deleteConfirm}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" small loading={busy === "delete"} onClick={() => void remove()}>{o.deleteYes}</Button>
              <Button variant="secondary" small onClick={() => setConfirm(false)}>{o.deleteNo}</Button>
            </div>
          </Notice>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" small onClick={onRerecord}><RotateCcw className="size-4" aria-hidden="true" />{o.rerecord}</Button>
            <Button variant="danger" small onClick={() => setConfirm(true)}><Trash2 className="size-4" aria-hidden="true" />{o.delete}</Button>
          </div>
        )
      )}
    </Card>
  );
}

/* ---------- Legacy Book ---------- */

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function BookEditor({ copy, initial, readOnly, reload }: { copy: Copy; initial: LegacyBook; readOnly: boolean; reload: () => Promise<void> }) {
  const b = copy.owner.book;
  const { service, snap, notify } = useEstate();
  const [book, setBook] = useState<LegacyBook>(initial);
  const [lists, setLists] = useState({ values: initial.values.join("\n"), lessons: initial.lessons.join("\n"), phrases: initial.phrases.join("\n") });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = useId();

  const setG = (topic: (typeof GUIDANCE_TOPICS)[number], v: string) => setBook((x) => ({ ...x, guidance: { ...x.guidance, [topic]: v } }));
  const setChild = (cid: string, patch: Partial<LegacyBook["children"][number]>) => setBook((x) => ({ ...x, children: x.children.map((c) => (c.id === cid ? { ...c, ...patch } : c)) }));
  const setM = (mid: string, patch: Partial<Milestone>) => setBook((x) => ({ ...x, milestones: x.milestones.map((m) => (m.id === mid ? { ...m, ...patch } : m)) }));
  const addM = () => setBook((x) => ({ ...x, milestones: [...x.milestones, { id: `m-${Date.now().toString(36)}`, childId: "all", kind: "other", title: "", text: "" }] }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !snap) return;
    const candidate = { ...book, values: lines(lists.values), lessons: lines(lists.lessons), phrases: lines(lists.phrases) };
    const p = legacyBookSchema.safeParse(candidate);
    if (!p.success) { setError(`${b.invalid} (${p.error.issues[0]?.path.join(" › ")}: ${p.error.issues[0]?.message})`); return; }
    setBusy(true); setError(null);
    try { const saved = await service.saveLegacyBook(snap.estate.address, p.data); setBook(saved); notify("ok", b.saved); await reload(); }
    catch (err) { setError(legacyError(err, copy.child.error)); }
    finally { setBusy(false); }
  };
  const del = async () => {
    if (!service || !snap) return;
    setBusy(true);
    try { await service.deleteLegacyBook(snap.estate.address); notify("ok", b.deletedBook); await reload(); }
    catch (err) { setError(legacyError(err, copy.child.error)); }
    finally { setBusy(false); setConfirmDelete(false); }
  };

  const area = (key: string, label: string, value: string, onChange: (v: string) => void, hint?: string, rows = 3) => (
    <Field label={label} htmlFor={`${id}-${key}`} hint={hint}>
      <textarea id={`${id}-${key}`} rows={rows} readOnly={readOnly} value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputClass, "min-h-24 py-2.5")} />
    </Field>
  );

  return (
    <Card>
      <h2 className="text-h3">{b.title}</h2>
      <p className="mt-1 text-ink-2">{b.body}</p>
      <form onSubmit={save} noValidate className="mt-4 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={b.calledBy} htmlFor={`${id}-called`} hint={b.calledByHint}>
            <input id={`${id}-called`} className={inputClass} readOnly={readOnly} value={book.calledBy} onChange={(e) => setBook((x) => ({ ...x, calledBy: e.target.value }))} />
          </Field>
          <Field label={b.pronoun} htmlFor={`${id}-pronoun`}>
            <select id={`${id}-pronoun`} className={inputClass} disabled={readOnly} value={book.pronoun} onChange={(e) => setBook((x) => ({ ...x, pronoun: e.target.value as LegacyBook["pronoun"] }))}>
              {(["he", "she", "they"] as const).map((p) => <option key={p} value={p}>{b.pronouns[p]}</option>)}
            </select>
          </Field>
        </div>
        {area("values", b.values, lists.values, (v) => setLists((l) => ({ ...l, values: v })), b.valuesHint, 4)}
        {area("lessons", b.lessons, lists.lessons, (v) => setLists((l) => ({ ...l, lessons: v })), b.lessonsHint)}
        {area("phrases", b.phrases, lists.phrases, (v) => setLists((l) => ({ ...l, phrases: v })), b.phrasesHint)}

        <fieldset className="grid gap-3 rounded-md border border-line p-3.5">
          <legend className="px-1 font-semibold">{b.guidanceTitle}</legend>
          {GUIDANCE_TOPICS.map((t) => <div key={t}>{area(`g-${t}`, b.topics[t], book.guidance[t], (v) => setG(t, v), undefined, 2)}</div>)}
        </fieldset>

        {book.children.map((c) => (
          <details key={c.id} className="rounded-md border border-line p-3.5 [&[open]>summary]:mb-3">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">{fmt(b.childTitle, { name: c.name })}</summary>
            <div className="grid gap-3">
              {GUIDANCE_TOPICS.map((t) => <div key={t}>{area(`${c.id}-${t}`, b.topics[t], c.guidance[t], (v) => setChild(c.id, { guidance: { ...c.guidance, [t]: v } }), undefined, 2)}</div>)}
              {area(`${c.id}-note`, fmt(b.childNote, { name: c.name }), c.note, (v) => setChild(c.id, { note: v }), undefined, 2)}
            </div>
          </details>
        ))}

        <section aria-labelledby={`${id}-ms`} className="grid gap-3">
          <div>
            <h3 id={`${id}-ms`} className="text-body font-semibold">{b.milestonesTitle}</h3>
            <p className="text-small text-ink-2">{b.milestonesBody}</p>
          </div>
          {book.milestones.map((m) => (
            <div key={m.id} className="grid gap-3 rounded-md border border-line p-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={b.milestoneFor} htmlFor={`${m.id}-for`}>
                  <select id={`${m.id}-for`} className={inputClass} disabled={readOnly} value={m.childId} onChange={(e) => setM(m.id, { childId: e.target.value })}>
                    <option value="all">{b.milestoneAll}</option>
                    {book.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label={b.milestoneKind} htmlFor={`${m.id}-kind`}>
                  <select id={`${m.id}-kind`} className={inputClass} disabled={readOnly} value={m.kind} onChange={(e) => setM(m.id, { kind: e.target.value as Milestone["kind"] })}>
                    {MILESTONE_KINDS.map((k) => <option key={k} value={k}>{b.kinds[k]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={b.milestoneTitle} htmlFor={`${m.id}-title`}>
                <input id={`${m.id}-title`} className={inputClass} readOnly={readOnly} value={m.title} onChange={(e) => setM(m.id, { title: e.target.value })} />
              </Field>
              {area(`${m.id}-text`, b.milestoneText, m.text, (v) => setM(m.id, { text: v }), undefined, 4)}
              {!readOnly && (
                <Button variant="ghost" small className="justify-self-start text-danger" onClick={() => setBook((x) => ({ ...x, milestones: x.milestones.filter((y) => y.id !== m.id) }))}>
                  <Trash2 className="size-4" aria-hidden="true" />{b.removeMilestone}
                </Button>
              )}
            </div>
          ))}
          {!readOnly && <Button variant="secondary" small className="justify-self-start" onClick={addM}><Plus className="size-4" aria-hidden="true" />{b.addMilestone}</Button>}
        </section>

        {error && <p role="alert" className="text-small font-medium text-danger">{error}</p>}
        {!readOnly && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="flex-1" loading={busy}>{b.save}</Button>
            {confirmDelete
              ? <Button variant="danger" loading={busy} onClick={() => void del()}>{b.deleteBookConfirm}</Button>
              : <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" aria-hidden="true" />{b.deleteBook}</Button>}
          </div>
        )}
      </form>
    </Card>
  );
}

/* ---------- preview ---------- */

function Preview({ copy, book }: { copy: Copy; book: LegacyBook }) {
  const p = copy.owner.preview;
  const { service, snap } = useEstate();
  const [childId, setChildId] = useState(book.children[0]?.id ?? "");
  const kid = book.children.find((c) => c.id === childId);
  const name = kid?.name ?? "";
  const { play, stop, playing } = useLegacyPlayer(book.pronoun);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ q: string; text: string; voice: "parent" | "heirloom"; speech?: LegacySpeech } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sid = useId();
  const ms = useMemo(() => book.milestones.filter((m) => m.childId === "all" || m.childId === childId), [book, childId]);

  const playM = async (m: Milestone) => {
    if (!service || !snap) return;
    setError(null);
    try { await play(m.id, await service.legacySpeak(snap.estate.address, { milestoneId: m.id })); }
    catch (e) { setError(legacyError(e, copy.child.error)); }
  };
  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!service || !snap || !q.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await service.legacyChat(snap.estate.address, [{ role: "user", text: q.trim() }], { previewChildId: childId });
      const asked = q.trim();
      setQ("");
      const s = await service.legacySpeak(snap.estate.address, { text: r.reply, token: r.speakToken }, r.voice);
      setAnswer({ q: asked, text: r.reply, voice: r.voice, speech: s });
      setBusy(false);
      await play("answer", s);
    } catch (err) { setError(legacyError(err, copy.child.error)); setBusy(false); }
  };

  return (
    <Card>
      <h2 className="text-h3">{fmt(p.title, { name })}</h2>
      <p className="mt-1 text-ink-2">{fmt(p.body, { name })}</p>
      {book.children.length > 1 && (
        <Field label={p.child} htmlFor={`${sid}-child`} className="mt-3 max-w-xs">
          <select id={`${sid}-child`} className={inputClass} value={childId} onChange={(e) => { setChildId(e.target.value); setAnswer(null); stop(); }}>
            {book.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      {ms.length === 0 ? <p className="mt-3 text-ink-2">{p.none}</p> : (
        <ul className="mt-3 grid gap-2">
          {ms.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md border border-line p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{m.title}</span>
                <span className="block text-small text-ink-2">{copy.owner.book.kinds[m.kind]}</span>
              </span>
              <PlayButton small playing={playing === m.id} onPlay={() => void playM(m)} onStop={stop} label={p.play} stopLabel={copy.child.stopPlaying} />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={ask} className="mt-4 grid gap-2">
        <label htmlFor={`${sid}-q`} className="text-small font-semibold">{fmt(p.ask, { name })}</label>
        <div className="flex gap-2">
          <input id={`${sid}-q`} className={inputClass} value={q} placeholder={p.askPlaceholder} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" loading={busy} disabled={!q.trim()}>{copy.child.send}</Button>
        </div>
      </form>
      {answer && (
        <ul className="mt-4 flex flex-col gap-3">
          <Bubble role="user" text={answer.q} copy={copy} called={book.calledBy} />
          <Bubble role="agent" text={answer.text} voice={answer.voice} copy={copy} called={book.calledBy}
            action={answer.speech && <PlayButton small playing={playing === "answer"} onPlay={() => void play("answer", answer.speech!)} onStop={stop} label={copy.child.replay} stopLabel={copy.child.stopPlaying} />} />
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-small font-medium text-danger">{error}</p>}
    </Card>
  );
}
