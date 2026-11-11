"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarClock, CarFront, Check, Clock, GraduationCap, Hourglass, Lock, PenLine, Phone, ShieldCheck, Sparkles, UsersRound, Zap } from "lucide-react";
import type { ScreensCopy } from "@/content/screens";
import { useLocale, useLocalized } from "@/lib/i18n/client";
import type { EstateSnapshot, TxResult } from "@/lib/service";
import type { WalletSession, WillChatMessage, WillDraft } from "@/lib/types";
import { formatUsdt, shortAddress, toBase } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { Badge, Button, ButtonLink, Card, Consent, Eyebrow, ExplorerLink, Notice, PageHeader } from "@/components/ui/primitives";
import { Bubble, Chips, Composer, Thinking } from "@/components/agent/chat-parts";
import { fmt, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";
import { categoryIcon } from "./estate";

type Copy = ScreensCopy["will"];
interface Msg extends WillChatMessage { id: number; fresh?: boolean }
const usd = (n: number) => formatUsdt(toBase(n), { decimals: 0 });
const longDate = (iso: string | number) => new Date(typeof iso === "number" ? iso * 1000 : iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

export function WillScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.will);
  return (
    <Gate roles={["owner"]} allowEmpty>
      {({ snap, session }) => <WillFlow copy={copy} snap={snap} session={session} />}
    </Gate>
  );
}

function WillFlow({ copy, snap, session }: { copy: Copy; snap: EstateSnapshot | null; session: WalletSession }) {
  // Kept here so the "locked in" moment survives the estate appearing underneath it.
  const [txs, setTxs] = useState<TxResult[] | null>(null);
  if (txs) return <Done copy={copy} txs={txs} />;
  if (snap) return <Locked copy={copy} snap={snap} />;
  return <Writer copy={copy} session={session} onSigned={setTxs} />;
}

function Done({ copy, txs }: { copy: Copy; txs: TxResult[] }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="mx-auto max-w-xl text-center">
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }} className="mx-auto grid size-20 place-items-center rounded-full bg-accent text-accent-ink">
        <Lock className="size-9" aria-hidden="true" />
      </motion.span>
      <h1 className="mt-5 text-h1" role="status">{copy.done.title}</h1>
      <p className="mt-3 text-lead text-ink-2">{copy.done.body}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink href="/vault">{copy.done.fund}<ArrowRight className="size-5" aria-hidden="true" /></ButtonLink>
        <ButtonLink href="/car" variant="secondary">{copy.done.car}</ButtonLink>
        <ButtonLink href="/estate" variant="ghost">{copy.done.estate}</ButtonLink>
      </div>
      {txs.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5">
          <span className="text-small text-ink-2">{copy.done.receipts}</span>
          {txs.map((t, i) => <ExplorerLink key={t.signature} signature={t.signature} label={fmt(copy.done.receipt, { n: i + 1 })} srLabel={copy.done.receiptSr} />)}
        </div>
      )}
    </motion.div>
  );
}

/* ---------- Conversation + live preview + review + sign ---------- */

function Writer({ copy, session, onSigned }: { copy: Copy; session: WalletSession; onSigned: (txs: TxResult[]) => void }) {
  const locale = useLocale();
  const { common, assistant } = useCopy();
  const { service, run, busy, openAgent } = useEstate();
  const first = session.label.split(/[ (]/)[0];
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, role: "agent", text: fmt(copy.greeting, { name: first }) }]);
  const [rawDraft, setDraft] = useState<WillDraft | null>(null);
  // The owner's own Now / After-I'm-gone choices, kept when the agent sends a fresh draft.
  const [starts, setStarts] = useState<Record<number, boolean>>({});
  const draft = useMemo<WillDraft | null>(
    () => (rawDraft ? { ...rawDraft, rules: rawDraft.rules.map((r, i) => (i in starts ? { ...r, startsNow: starts[i] } : r)) } : null),
    [rawDraft, starts],
  );
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [view, setView] = useState<"chat" | "review">("chat");
  const id = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const scroll = useCallback(() => end.current?.scrollIntoView({ block: "nearest" }), []);
  useEffect(() => { if (messages.length > 1 || pending) scroll(); }, [messages.length, pending, scroll]);

  const turns = messages.filter((m) => m.role === "user").length;
  const complete = !!draft && draft.assets.length > 0 && draft.verifiers.length >= 3 && draft.rules.length > 0;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !service || pending) return;
    setFailed(null);
    const history: WillChatMessage[] = [...messages.map(({ role, text: t }) => ({ role, text: t })), { role: "user", text: trimmed }];
    setMessages((m) => [...m.map((x) => ({ ...x, fresh: false })), { id: ++id.current, role: "user", text: trimmed }]);
    setPending(true);
    try {
      const res = await service.willChat(history, locale);
      setMessages((m) => [...m, { id: ++id.current, role: "agent", text: res.reply, fresh: true }]);
      if (res.draft) setDraft(res.draft);
    } catch {
      setFailed(trimmed);
    } finally {
      setPending(false);
    }
  };

  const sign = async () => {
    if (!draft) return;
    const res = await run("sign", (s) => s.createEstateFromWill(draft));
    if (res.ok) onSigned(res.value.txs);
  };

  if (view === "review" && draft) {
    return <Review copy={copy} draft={draft} onBack={() => setView("chat")} onSign={sign} signing={busy === "sign"} />;
  }

  const chips = turns < copy.suggestions.length ? copy.suggestions[turns] : copy.suggestions[copy.suggestions.length - 1];
  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow} title={copy.title} body={copy.body}
        action={<Button variant="secondary" small onClick={() => openAgent("call")}><Phone className="size-4" aria-hidden="true" />{copy.talk}</Button>}
      />
      <div className="grid gap-5 *:min-w-0 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <section aria-label={copy.eyebrow} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-3 shadow-card sm:p-4">
          <ul role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-4">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} fresh={m.fresh} specialist={m.role === "agent" ? "WillWriter" : undefined} copy={assistant} onTick={scroll} onTyped={scroll} />
            ))}
            {pending && <Thinking label={copy.thinking} />}
          </ul>
          {failed && (
            <Notice tone="danger" className="mt-3">
              <p role="alert">{copy.error}</p>
              <Button small variant="secondary" className="mt-2" onClick={() => { const t = failed; setMessages((m) => m.slice(0, -1)); void send(t); }}>{copy.retry}</Button>
            </Notice>
          )}
          <div ref={end} className="h-3" />

          {!consent && turns === 0 ? (
            <div className="mt-2">
              <p className="mb-1.5 text-small font-semibold">{copy.consentLead}</p>
              <Consent id="will-consent" checked={consent} onChange={setConsent} copy={common.consent} />
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              {!pending && !failed && <Chips items={chips} onPick={(s) => (s === copy.suggestions[3][1] ? setView("review") : void send(s))} label={copy.suggestionsLabel} />}
              <Composer onSend={send} disabled={pending} copy={copy.composer} />
            </div>
          )}
        </section>

        <div className="lg:sticky lg:top-[calc(var(--header-h)+4.5rem)]">
          <Preview copy={copy} draft={draft} onStart={(i, now) => setStarts((prev) => ({ ...prev, [i]: now }))} />
          <AnimatePresence>
            {complete && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                <Button block onClick={() => setView("review")}><PenLine className="size-5" aria-hidden="true" />{copy.reviewCta}</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

/* ---------- Live rules preview ---------- */

function Slot({ icon, title, filled, pending, children }: { icon: ReactNode; title: string; filled: boolean; pending: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-md border p-3 transition-colors duration-500", filled ? "border-line bg-surface" : "border-dashed border-line-strong/60 bg-transparent")}>
      <p className="flex items-center gap-2 text-small font-semibold">
        <span className={clsx("grid size-7 place-items-center rounded-full", filled ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>{filled ? <Check className="size-4" aria-hidden="true" /> : icon}</span>
        {title}
      </p>
      <div className="mt-2 text-small">{filled ? children : <span className="text-ink-2">{pending}</span>}</div>
    </div>
  );
}

function Preview({ copy, draft, onStart }: { copy: Copy; draft: WillDraft | null; onStart: (index: number, now: boolean) => void }) {
  const { common } = useCopy();
  const p = copy.preview;
  const parts = [!!draft?.beneficiaries.length, !!draft?.rules.length, (draft?.verifiers.length ?? 0) >= 3, !!draft?.assets.length];
  const done = parts.filter(Boolean).length;
  const item = { initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0 } };
  return (
    <Card aria-label={p.title} className="bg-surface-2/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3">{p.title}</h2>
        <Badge tone={done === 4 ? "ok" : "accent"}><Sparkles className="size-3.5" aria-hidden="true" />{done === 4 ? p.ready : p.live}</Badge>
      </div>
      <p className="mt-1 text-small text-ink-2" role="status" aria-live="polite">{draft ? fmt(p.progress, { done }) : p.emptyHint}</p>
      <div className="mt-3 grid gap-2.5">
        <Slot icon={<UsersRound className="size-4" aria-hidden="true" />} title={p.family} filled={parts[0]} pending={p.pending}>
          <ul className="flex flex-wrap gap-1.5">
            {draft?.beneficiaries.map((b) => (
              <motion.li key={b.label} {...item} className="rounded-full border border-ink px-2.5 py-1 font-medium text-ink">{b.label.split(" ")[0]} · {b.relationship}</motion.li>
            ))}
          </ul>
        </Slot>
        <Slot icon={<GraduationCap className="size-4" aria-hidden="true" />} title={p.rules} filled={parts[1]} pending={p.pending}>
          <p className="mb-2 text-[0.75rem] text-ink-2">{p.startHint}</p>
          <ul className="flex flex-col gap-2">
            {draft?.rules.map((r, i) => {
              const Icon = categoryIcon[r.category];
              const cat = common.status.category[r.category];
              return (
                <motion.li key={`${r.beneficiaryLabel}-${r.category}-${i}`} {...item} transition={{ delay: i * 0.08 }} className="rounded-md border border-line bg-surface-2/50 p-2.5">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p><span className="font-semibold">{r.beneficiaryLabel}</span> · {cat}</p>
                      <p className="text-ink-2">
                        {r.recurring
                          ? fmt(p.recurringLine, { amount: usd(r.recurring.amountUsdt), every: p.every[r.recurring.every], payee: r.recurring.payeeName })
                          : fmt(p.ruleLine, { category: p.onClaim, max: usd(r.maxPerClaimUsdt), cap: usd(r.lifetimeCapUsdt) })}
                      </p>
                    </div>
                    {r.recurring && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-ink px-2 py-0.5 text-[0.7rem] font-semibold text-ink"><CalendarClock className="size-3" aria-hidden="true" />{p.scheduled}</span>}
                  </div>
                  <fieldset className="mt-2">
                    <legend className="sr-only">{fmt(p.startLabel, { category: cat.toLowerCase(), name: r.beneficiaryLabel })}</legend>
                    <div className="flex rounded-full bg-surface p-0.5 ring-1 ring-line-strong">
                      {[true, false].map((now) => (
                        <label key={String(now)} className={clsx("flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-[0.8rem] font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", r.startsNow === now ? (now ? "bg-accent text-accent-ink" : "bg-ink text-bg") : "text-ink-2")}>
                          <input type="radio" name={`start-${i}`} className="sr-only" checked={r.startsNow === now} onChange={() => onStart(i, now)} />
                          {now ? <Zap className="size-3.5" aria-hidden="true" /> : <Hourglass className="size-3.5" aria-hidden="true" />}
                          {now ? p.now : p.later}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </motion.li>
              );
            })}
          </ul>
        </Slot>
        <Slot icon={<ShieldCheck className="size-4" aria-hidden="true" />} title={p.trusted} filled={parts[2]} pending={p.pending}>
          <ul className="flex flex-col gap-1">
            {draft?.verifiers.map((v, i) => (
              <motion.li key={v.name} {...item} transition={{ delay: i * 0.08 }}><span className="font-semibold">{v.name}</span> · <span className="text-ink-2">{v.role}</span></motion.li>
            ))}
          </ul>
        </Slot>
        <Slot icon={<CarFront className="size-4" aria-hidden="true" />} title={p.car} filled={parts[3]} pending={p.pending}>
          {draft?.assets.map((a) => (
            <motion.div key={a.title} {...item}>
              <p className="font-semibold">{a.title}</p>
              <p>{fmt(p.carFloor, { floor: usd(a.floorPriceUsdt) })} · {fmt(p.carHardship, { floor: usd(a.hardshipFloorUsdt) })}</p>
            </motion.div>
          ))}
        </Slot>
        {draft && (
          <p className="flex items-center gap-2 px-1 text-small text-ink-2"><Clock className="size-4 shrink-0" aria-hidden="true" />{p.waiting}: {fmt(p.waitingValue, { days: draft.waitingPeriodDays })}</p>
        )}
      </div>
    </Card>
  );
}

/* ---------- Plain-language review ---------- */

function Review({ copy, draft, onBack, onSign, signing }: { copy: Copy; draft: WillDraft; onBack: () => void; onSign: () => void; signing: boolean }) {
  const { common } = useCopy();
  const r = copy.review;
  const need = 2;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mx-auto max-w-2xl">
      <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-full pr-3 text-small font-semibold text-accent"><ArrowLeft className="size-4" aria-hidden="true" />{r.back}</button>
      <Eyebrow>{r.eyebrow}</Eyebrow>
      <h1 className="mt-1.5 text-h1">{r.title}</h1>

      <Card className="mt-5 border-ink bg-surface-2">
        <h2 className="text-h3">{r.summaryTitle}</h2>
        <p className="mt-2 text-lead">{draft.plainLanguageSummary}</p>
      </Card>

      {([true, false] as const).map((now) => {
        const group = draft.rules.filter((rule) => rule.startsNow === now);
        return (
          <section key={String(now)} className="mt-6">
            <h2 className="flex items-center gap-2 text-h3">
              {now ? <Zap className="size-5 text-accent" aria-hidden="true" /> : <Hourglass className="size-5 text-brass" aria-hidden="true" />}
              {now ? r.nowTitle : r.laterTitle}
            </h2>
            <p className="mt-1 text-small text-ink-2">{now ? (group.length ? r.nowBody : r.noneNow) : r.laterBody}</p>
            <ol className="mt-3 grid gap-2.5">
              {group.map((rule, i) => {
                const Icon = categoryIcon[rule.category];
                const base = {
                  name: rule.beneficiaryLabel, category: common.status.category[rule.category].toLowerCase(), kind: common.status.payeeKind[rule.allowedPayeeKind].toLowerCase(),
                  max: usd(rule.maxPerClaimUsdt), cap: usd(rule.lifetimeCapUsdt), date: longDate(rule.validUntil),
                };
                return (
                  <li key={i} className="flex gap-3 rounded-md border border-line bg-surface p-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon className="size-5" aria-hidden="true" /></span>
                    <p>{rule.recurring
                      ? fmt(r.recurringRule, { ...base, amount: usd(rule.recurring.amountUsdt), payee: rule.recurring.payeeName, every: copy.preview.every[rule.recurring.every] })
                      : fmt(r.rule, base)}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <section className="mt-6">
        <h2 className="text-h3">{r.trustedTitle}</h2>
        <p className="mt-2 text-ink-2">{fmt(r.trusted, { need, days: draft.waitingPeriodDays })}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {draft.verifiers.map((v) => (
            <li key={v.name} className="rounded-md border border-line bg-surface p-3">
              <p className="font-semibold">{v.name}</p>
              <p className="text-small text-ink-2">{v.role}</p>
            </li>
          ))}
        </ul>
      </section>

      {draft.assets.map((a) => (
        <section key={a.title} className="mt-6">
          <h2 className="text-h3">{r.carTitle}</h2>
          <p className="mt-2">{fmt(r.car, { title: a.title, floor: usd(a.floorPriceUsdt), proceeds: a.proceedsTo })}</p>
          <p className="mt-2 text-ink-2">{fmt(r.carHardship, { policy: a.hardshipPolicy, floor: usd(a.hardshipFloorUsdt) })}</p>
        </section>
      ))}

      <section className="mt-6">
        <h2 className="text-h3">{r.limitsTitle}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-2 marker:text-brass">
          {r.limits.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>

      <div className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-b))] -mx-4 mt-6 border-t border-ink bg-bg px-4 py-3 md:bottom-0">
        <Button block onClick={onSign} loading={signing} className="min-h-13!">
          <Lock className="size-5" aria-hidden="true" />{signing ? r.signing : r.sign}
        </Button>
        <p className="mt-2 text-center text-small text-ink-2">{r.signNote}</p>
      </div>
    </motion.div>
  );
}

/* ---------- After signing: the will as it stands on-chain ---------- */

function Locked({ copy, snap }: { copy: Copy; snap: EstateSnapshot }) {
  const { common } = useCopy();
  const { openAgent } = useEstate();
  const l = copy.locked;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={copy.eyebrow} title={l.title} body={l.body} />
      <ol className="grid gap-2.5">
        {snap.rules.map((rule) => {
          const Icon = categoryIcon[rule.category];
          const who = snap.beneficiaries.find((b) => b.wallet === rule.beneficiary)?.label ?? "";
          const base = {
            name: who, category: common.status.category[rule.category].toLowerCase(), kind: common.status.payeeKind[rule.allowedPayeeKind].toLowerCase(),
            max: formatUsdt(rule.maxPerClaim, { decimals: 0 }), cap: formatUsdt(rule.lifetimeCap, { decimals: 0 }), date: longDate(rule.validUntil),
          };
          const recurring = rule.recurringAmount > BigInt(0);
          return (
            <li key={rule.address} className="flex gap-3 rounded-md border border-line bg-surface p-3.5 shadow-card">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <Badge tone={rule.startsNow ? "gold" : "neutral"}>{rule.startsNow ? <Zap className="size-3.5" aria-hidden="true" /> : <Hourglass className="size-3.5" aria-hidden="true" />}{rule.startsNow ? copy.preview.now : copy.preview.later}</Badge>
                <p className="mt-1.5">{recurring
                  ? fmt(copy.review.recurringRule, { ...base, amount: formatUsdt(rule.recurringAmount, { decimals: 0 }), payee: snap.payees.find((x) => x.wallet === rule.fixedPayee)?.name ?? "", every: copy.preview.every[rule.intervalSecs <= 60 ? "minute" : "month"] })
                  : fmt(copy.review.rule, base)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {snap.estate.willHash && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-small text-ink-2"><Lock className="size-4" aria-hidden="true" />{l.fingerprint}: <span className="font-mono text-ink">{shortAddress(snap.estate.willHash, 10)}</span></p>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/estate">{l.estate}<ArrowRight className="size-5" aria-hidden="true" /></ButtonLink>
        <Button variant="secondary" onClick={() => openAgent("chat")}>{l.ask}</Button>
      </div>
    </div>
  );
}
