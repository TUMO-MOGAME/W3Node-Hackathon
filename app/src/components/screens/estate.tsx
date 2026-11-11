"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, CalendarClock, CarFront, CircleDot, FileCheck2, GraduationCap, HeartPulse, Hourglass, House, Landmark, Milestone, Plus, Send, Stethoscope, UsersRound, Zap, type LucideIcon } from "lucide-react";
import type { ScreensCopy } from "@/content/screens";
import { useLocalized } from "@/lib/i18n/client";
import type { EstateSnapshot } from "@/lib/service";
import type { Category, EstateStatus, Role, Rule, WalletSession } from "@/lib/types";
import { formatUsdt, formatZar } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { useNow } from "@/lib/hooks/use-now";
import { Badge, Button, ButtonLink, Card, Eyebrow, ExplorerLink, Meter, type Tone } from "@/components/ui/primitives";
import { ownerPending, pendingFor } from "@/components/shell/app-shell";
import { usePay } from "@/components/pay/payment";
import { clock } from "./family";
import { fmt, timeAgo, useCopy } from "@/components/shell/copy";
import { Gate } from "@/components/shell/gate";
import { InstallBanner } from "@/components/shell/install";
import { LegacyEntry } from "@/components/legacy/legacy-entry";

type Copy = ScreensCopy["estate"];
export const statusTone: Record<EstateStatus, Tone> = { Active: "accent", DeathPending: "warn", Unlocked: "ok", Frozen: "danger" };
export const categoryIcon: Record<Category, LucideIcon> = { Tuition: GraduationCap, Accommodation: House, Books: BookOpen, Medical: Stethoscope, General: CircleDot };

export function EstateScreen({ copy: english }: { copy: Copy }) {
  const copy = useLocalized(english, (t) => t.screens.estate);
  return <Gate>{({ snap, session, role }) => <Dashboard copy={copy} snap={snap!} session={session} role={role} />}</Gate>;
}

function Dashboard({ copy, snap, session, role }: { copy: Copy; snap: EstateSnapshot; session: WalletSession; role: Role }) {
  const { common } = useCopy();
  const { fx, setProofOpen, run, busy, walletUsdt } = useEstate();
  const now = useNow(10000);
  const e = snap.estate;
  const rate = fx?.usdtZar ?? null;
  const car = snap.assets[0];
  const first = e.ownerName.split(" ")[0];

  return (
    <div className="grid gap-5 *:min-w-0 lg:grid-cols-[1.35fr_1fr] lg:items-start">
      <div className="grid gap-5 *:min-w-0">
        <InstallBanner copy={common.install} />
        <LegacyEntry />

        {/* Vault hero */}
        <section aria-labelledby="estate-title" className="brand-panel relative overflow-hidden rounded-xl p-5 sm:p-6">
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-small font-semibold uppercase tracking-[0.14em] opacity-80">{copy.eyebrow}</p>
                <h1 id="estate-title" className="text-h2">{fmt(copy.title, { name: first })}</h1>
              </div>
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-ink px-3 text-small font-semibold text-bg">
                <span className={clsx("size-2 rounded-full", e.status === "DeathPending" ? "animate-pulse-soft bg-bg" : "bg-bg")} aria-hidden="true" />
                {common.status.estate[e.status]}
              </span>
            </div>
            <p className="mt-5 flex items-center gap-2 text-small font-medium opacity-90"><Landmark className="size-4" aria-hidden="true" />{copy.vault}</p>
            <motion.p key={e.vaultBalance.toString()} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="font-display text-display leading-none tabular-nums">
              {formatUsdt(e.vaultBalance).replace(" USD₮", "")}<span className="ml-2 text-h3">USD₮</span>
            </motion.p>
            <p className="mt-1.5 min-h-6 text-lead opacity-95 tabular-nums">{rate ? `≈ ${formatZar(e.vaultBalance, rate)}` : ""}</p>
            <p className="mt-1 min-h-5 text-small opacity-80">{fx ? fmt(copy.rate, { rate: fx.usdtZar.toFixed(2), source: fx.source }) : ""}</p>
            <p className="mt-3 text-small opacity-90">{common.status.estateHint[e.status]}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {role === "owner" && e.status === "Active" && (
                <ButtonLink href="/vault"><Plus className="size-5" aria-hidden="true" />{copy.addFunds}</ButtonLink>
              )}
              <Link href="/send" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink px-5 font-medium hover:bg-surface-2"><Send className="size-5" aria-hidden="true" />{copy.send}</Link>
              <button type="button" onClick={() => setProofOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink px-5 font-medium hover:bg-surface-2">
                <FileCheck2 className="size-5" aria-hidden="true" />{copy.openProof}
              </button>
            </div>
          </div>
        </section>

        <ForYou copy={copy} snap={snap} session={session} role={role} now={now} onHeartbeat={() => run("heartbeat", (s, est) => s.heartbeat(est), copy.forYou.owner.done)} busy={busy === "heartbeat"} walletUsdt={walletUsdt} rate={rate} />

        <Scheduled copy={copy} snap={snap} rate={rate} />

        {/* Rules */}
        <section aria-labelledby="rules-title">
          <div className="mb-3">
            <h2 id="rules-title" className="text-h3">{copy.rules.title}</h2>
            <p className="text-small text-ink-2">{copy.rules.body}</p>
          </div>
          {snap.rules.length === 0 ? <p className="text-ink-2">{copy.rules.empty}</p> : (
            <ul className="grid gap-3 *:min-w-0 sm:grid-cols-2">
              {snap.rules.map((r) => <RuleCard key={r.address} rule={r} snap={snap} copy={copy} rate={rate} now={now} />)}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-5 *:min-w-0">
        {/* Car */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-h3"><CarFront className="size-5 text-accent" aria-hidden="true" />{copy.car.title}</h2>
            {car && <Badge tone={car.status === "Sold" ? "ok" : car.status === "Listed" ? "warn" : "neutral"}>{common.status.asset[car.status]}</Badge>}
          </div>
          {car ? (
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{car.title}</p>
                <p className="text-small text-ink-2">{copy.car.floor}: {formatUsdt(car.floorPrice, { decimals: 0 })}{rate ? ` (≈ ${formatZar(car.floorPrice, rate)})` : ""}</p>
              </div>
              <ButtonLink href="/car" variant="secondary" small>{copy.car.view}<ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-2">{copy.car.none}</p>
              {role === "owner" && e.status === "Active" && <ButtonLink href="/car" variant="secondary" small>{copy.car.add}</ButtonLink>}
            </div>
          )}
        </Card>

        {/* Trusted people */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-h3"><UsersRound className="size-5 text-accent" aria-hidden="true" />{copy.people.title}</h2>
            <ButtonLink href="/people" variant="ghost" small>{copy.people.view}</ButtonLink>
          </div>
          <p className="text-small text-ink-2">{fmt(copy.people.body, { need: e.deathThreshold })}</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {e.verifierNames.map((n, i) => (
              <li key={e.verifiers[i]} className="flex items-center gap-2.5 text-small font-medium">
                <span className="grid size-8 place-items-center rounded-full border border-ink font-bold text-ink" aria-hidden="true">{n.replace(/^(Adv\.|Ms\.|Mr\.|Uncle|Aunt|Pastor)\s+/i, "")[0]}</span>
                {n}
              </li>
            ))}
          </ul>
        </Card>

        {/* Activity */}
        <Card>
          <h2 className="text-h3">{copy.activity.title}</h2>
          {snap.activity.length === 0 ? <p className="mt-2 text-ink-2">{copy.activity.empty}</p> : (
            <>
              <ol className="mt-2">
                {snap.activity.slice(0, 6).map((a, i) => (
                  <motion.li key={`${a.txSignature}-${a.ts}-${i}`} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="border-b border-line/70 py-2 last:border-0">
                    <p className="text-small font-medium">{a.text}</p>
                    <div className="flex flex-wrap items-center justify-between gap-x-3">
                      <span className="text-[0.75rem] text-ink-2">{timeAgo(a.ts, now, common.time)}</span>
                      {a.txSignature && <ExplorerLink signature={a.txSignature} label={copy.activity.receipt} srLabel={copy.activity.receiptSr} className="min-h-9!" />}
                    </div>
                  </motion.li>
                ))}
              </ol>
              <Button variant="quiet" small block className="mt-3" onClick={() => setProofOpen(true)}>{copy.activity.all}</Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function RuleCard({ rule, snap, copy, rate, now }: { rule: Rule; snap: EstateSnapshot; copy: Copy; rate: number | null; now: number | null }) {
  const { common } = useCopy();
  const { intent, setIntent } = useEstate();
  const ref = useRef<HTMLLIElement>(null);
  const [glow, setGlow] = useState(false);
  const who = snap.beneficiaries.find((b) => b.wallet === rule.beneficiary)?.label ?? "";
  const Icon = categoryIcon[rule.category];
  const used = rule.lifetimeCap > BigInt(0) ? Number(rule.spentTotal) / Number(rule.lifetimeCap) : 0;
  const date = new Date(rule.validUntil * 1000).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  const ended = now !== null && now > rule.validUntil;
  const hit = intent?.kind === "rule" && intent.rule === rule.address;

  useEffect(() => {
    if (!hit) return;
    // Reacts to a one-off "show me this rule" intent from the agent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGlow(true);
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    setIntent(null);
    const id = window.setTimeout(() => setGlow(false), 4000);
    return () => window.clearTimeout(id);
  }, [hit, setIntent]);

  return (
    <li ref={ref} className={clsx("rounded-lg border bg-surface p-4 shadow-card transition-shadow duration-500", glow ? "border-ink ring-2 ring-ink" : "border-line")}>
      {glow && <p className="sr-only" role="status">{copy.rules.highlighted}</p>}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1 basis-32">
          <h3 className="font-sans text-body font-semibold tracking-normal">{common.status.category[rule.category]}</h3>
          <p className="truncate text-small text-ink-2">{fmt(copy.rules.forWho, { name: who })}</p>
        </div>
        <Badge tone={rule.startsNow ? "gold" : "neutral"} className="ml-auto shrink-0">
          {rule.startsNow ? <Zap className="size-3.5" aria-hidden="true" /> : <Hourglass className="size-3.5" aria-hidden="true" />}
          <span className="sr-only">{rule.startsNow ? copy.rules.nowSr : copy.rules.laterSr}</span>
          <span aria-hidden="true">{rule.startsNow ? copy.rules.now : copy.rules.later}</span>
        </Badge>
      </div>
      <p className="mt-3 text-small"><span className="font-medium">{fmt(copy.rules.paidTo, { kind: common.status.payeeKind[rule.allowedPayeeKind].toLowerCase() })}</span> · {fmt(copy.rules.perClaim, { amount: formatUsdt(rule.maxPerClaim, { decimals: 0 }) })}</p>
      <div className="mt-3">
        <Meter value={used} label={fmt(copy.rules.meter, { category: common.status.category[rule.category], name: who })} tone={used >= 1 ? "brass" : "accent"} />
        <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-small">
          <span className="tabular-nums">{fmt(copy.rules.used, { spent: formatUsdt(rule.spentTotal, { decimals: 0 }).replace(" USD₮", ""), cap: formatUsdt(rule.lifetimeCap, { decimals: 0 }) })}</span>
          <span className="text-ink-2 tabular-nums">{rate ? `≈ ${fmt(copy.rules.left, { amount: formatZar(rule.lifetimeCap - rule.spentTotal, rate) })}` : ""}</span>
        </div>
      </div>
      <p className="mt-2 text-[0.75rem] text-ink-2">{fmt(ended ? copy.rules.ended : copy.rules.until, { date })}</p>
    </li>
  );
}

function ForYou({ copy, snap, session, role, now, onHeartbeat, busy, walletUsdt, rate }: {
  copy: Copy; snap: EstateSnapshot; session: WalletSession; role: Role; now: number | null; onHeartbeat: () => void; busy: boolean; walletUsdt: bigint; rate: number | null;
}) {
  const { common } = useCopy();
  const f = copy.forYou;
  const e = snap.estate;
  const reported = !!e.death.certHash || e.status === "DeathPending";
  let block: { title: string; body: string; cta: string; href: string } | null = null;
  if (role === "owner") {
    const mine = ownerPending(snap);
    if (reported && e.status !== "Unlocked") block = { ...f.ownerPending, href: "/family" };
    else if (mine > 0) block = { title: fmt(f.ownerClaims.title, { count: mine === 1 ? f.countOne : fmt(f.countMany, { n: mine }) }), body: f.ownerClaims.body, cta: f.ownerClaims.cta, href: "/claims" };
  } else if (role === "beneficiary") {
    block = e.status === "Unlocked" ? { ...f.beneficiaryUnlocked, href: "/claims" } : e.status === "DeathPending" ? { ...f.beneficiaryPending, href: "/family" } : { ...f.beneficiaryActive, href: "/claims" };
  } else if (role === "verifier") {
    const n = pendingFor(snap, session.address);
    block = n > 0
      ? { title: fmt(f.verifierWaiting.title, { count: n === 1 ? f.countOne : fmt(f.countMany, { n }) }), body: f.verifierWaiting.body, cta: f.verifierWaiting.cta, href: "/inbox" }
      : { ...f.verifierClear, href: "/inbox" };
  } else if (role === "buyer") block = { ...f.buyer, href: "/car" };

  return (
    <Card aria-label={f.title} className={clsx(block && role === "owner" && reported && "border-2 border-l-8 border-ink")}>
      <Eyebrow>{f.title}</Eyebrow>
      {block ? (
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 max-w-md">
            <h2 className="text-h3">{block.title}</h2>
            <p className="mt-1 text-ink-2">{block.body}</p>
          </div>
          <ButtonLink href={block.href}>{block.cta}<ArrowRight className="size-5" aria-hidden="true" /></ButtonLink>
        </div>
      ) : e.status === "Unlocked" ? (
        <p className="mt-1.5 text-ink-2">{common.status.estateHint.Unlocked}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 max-w-md">
            <h2 className="text-h3">{f.owner.heartbeat}</h2>
            <p className="mt-1 text-ink-2">{f.owner.body}</p>
            <p className="mt-1 min-h-5 text-small text-ink-2">{now !== null ? fmt(f.owner.last, { when: timeAgo(e.lastHeartbeat, now, common.time) }) : ""}</p>
          </div>
          <Button onClick={onHeartbeat} loading={busy}><HeartPulse className="size-5" aria-hidden="true" />{f.owner.heartbeat}</Button>
        </div>
      )}
      <p className="mt-3 border-t border-line/70 pt-1">
        <Link href="/family" className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-accent underline-offset-4 hover:underline"><Milestone className="size-4" aria-hidden="true" />{copy.timeline}<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </p>
      {(role === "owner" || role === "buyer") && (
        <p className="text-small text-ink-2">
          {copy.walletBalance}: <span className="font-semibold text-ink tabular-nums">{formatUsdt(walletUsdt)}</span>{rate ? ` (≈ ${formatZar(walletUsdt, rate)})` : ""}
        </p>
      )}
    </Card>
  );
}


/* ---------- Scheduled payments: living rules pay now, legacy schedules start at unlock ---------- */

function everyLabel(secs: number, t: Copy["scheduled"]["intervals"]): string {
  if (secs < 86400) return fmt(t.seconds, { n: secs });
  if (secs <= 8 * 86400) return t.week;
  if (secs <= 32 * 86400) return t.month;
  if (secs <= 200 * 86400) return t.term;
  if (secs <= 370 * 86400) return t.year;
  return fmt(t.days, { n: Math.round(secs / 86400) });
}

function Scheduled({ copy, snap, rate }: { copy: Copy; snap: EstateSnapshot; rate: number | null }) {
  const { busy } = useEstate();
  const { pay } = usePay();
  const now = useNow();
  const c = copy.scheduled;
  const e = snap.estate;
  const rules = snap.rules.filter((r) => r.recurringAmount > BigInt(0));
  if (rules.length === 0) return null;
  return (
    <section aria-labelledby="scheduled-title">
      <div className="mb-3">
        <h2 id="scheduled-title" className="flex items-center gap-2 text-h3"><CalendarClock className="size-5 text-accent" aria-hidden="true" />{c.title}</h2>
        <p className="text-small text-ink-2">{c.body}</p>
      </div>
      <ul className="grid gap-3">
        {rules.map((r) => {
          const payee = snap.payees.find((p) => p.wallet === r.fixedPayee)?.name ?? "";
          const who = snap.beneficiaries.find((b) => b.wallet === r.beneficiary)?.label.replace(/\s*\(.*\)$/, "") ?? "";
          const live = e.status === "Unlocked" || (r.startsNow && e.status === "Active");
          const capped = r.spentTotal + r.recurringAmount > r.lifetimeCap;
          const ended = now !== null && now > r.validUntil;
          const left = r.nextDue !== null && now !== null ? r.nextDue - now : null;
          const due = live && !capped && !ended && left !== null && left <= 0;
          const state = capped ? c.capReached : ended ? c.ended : !live ? (r.startsNow || e.status === "DeathPending" ? (e.status === "DeathPending" && r.startsNow ? c.paused : c.startsAfter) : c.startsAfter) : left === null ? "" : due ? c.dueNow : fmt(c.nextIn, { time: clock(left) });
          return (
            <li key={r.address} className={clsx("flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-4 shadow-card", due ? "border-[1.5px] border-dashed border-ink" : "border-line")}>
              <span className={clsx("grid size-10 shrink-0 place-items-center rounded-full", r.startsNow ? "bg-ink text-bg" : "border border-line-strong bg-surface text-ink-2")}>
                {r.startsNow ? <Zap className="size-5" aria-hidden="true" /> : <Hourglass className="size-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold">{fmt(c.line, { amount: formatUsdt(r.recurringAmount, { decimals: 0 }), payee })}</p>
                <p className="text-small text-ink-2">{fmt(c.forWho, { name: who, every: everyLabel(r.intervalSecs, c.intervals) })}{rate ? ` · ≈ ${formatZar(r.recurringAmount, rate)}` : ""}</p>
                <p className={clsx("mt-0.5 min-h-5 text-small font-semibold tabular-nums", due ? "text-ink" : "text-ink-2")} role="timer" aria-live="off">{state}</p>
              </div>
              {live && !capped && !ended && (
                <Button
                  small variant={due ? "primary" : "secondary"} disabled={!due || !!busy}
                  onClick={() => void pay({ kind: "scheduled", source: "vault", to: r.fixedPayee ?? "", toLabel: payee, amount: r.recurringAmount, execute: (svc, est) => svc.executeScheduled(est, r.address), successText: fmt(c.paid, { payee }) })}
                >
                  {c.payNow}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[0.75rem] text-ink-2">{c.anyone}</p>
    </section>
  );
}
