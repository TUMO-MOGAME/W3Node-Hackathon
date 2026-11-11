"use client";
import { ArrowDown, ArrowRight, BadgeCheck, Car, FileLock2, GraduationCap, HandHeart, HeartPulse, KeyRound, Landmark, MessageSquareHeart, PenLine, ShieldCheck, UsersRound } from "lucide-react";
import type { CSSProperties } from "react";
import type { LandingCopy } from "@/content/landing";
import { Badge, ButtonLink, Eyebrow } from "@/components/ui/primitives";
import { useLocalized } from "@/lib/i18n/client";

const stepIcons = [MessageSquareHeart, PenLine, GraduationCap];
const safetyIcons = [ShieldCheck, UsersRound, HeartPulse, HandHeart, FileLock2, KeyRound];
const rowIcons = [GraduationCap, GraduationCap, Car];

/**
 * The landing page's sections. Prerendered in English (the first screen needs no JavaScript: the
 * entrance is CSS-only); after hydration the visitor's chosen language is laid over the same markup.
 */
export function LandingBody({ copy: english }: { copy: LandingCopy }) {
  const { hero, problem, how, safety, proof, cta } = useLocalized(english, (t) => t.landing);
  return (
    <main id="main">
      {/* Hero: CSS-only entrance, no JavaScript needed for the first screen */}
      <section className="paper border-b border-line/70">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-14 pt-10 *:min-w-0 md:grid-cols-[1.1fr_0.9fr] md:pb-20 md:pt-16">
          <div>
            <Eyebrow className="rise">{hero.eyebrow}</Eyebrow>
            <h1 className="rise mt-3 text-display" style={{ "--i": 1 } as CSSProperties}>{hero.title}</h1>
            <p className="rise mt-5 max-w-xl text-lead text-ink-2" style={{ "--i": 2 } as CSSProperties}>{hero.body}</p>
            <div className="rise mt-7 flex flex-col gap-3 sm:flex-row" style={{ "--i": 3 } as CSSProperties}>
              <ButtonLink href="/start" className="min-h-13! px-7">{hero.primary}<ArrowRight className="size-5" aria-hidden="true" /></ButtonLink>
              <a href="#how" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-line-strong px-6 font-medium hover:bg-surface-2">{hero.secondary}<ArrowDown className="size-4" aria-hidden="true" /></a>
            </div>
            <p className="rise mt-4 text-small text-ink-2" style={{ "--i": 4 } as CSSProperties}>{hero.note}</p>
          </div>

          <div className="rise relative mx-auto w-full max-w-md" style={{ "--i": 3 } as CSSProperties} role="img" aria-label={`${hero.card.title}. ${hero.card.vaultLabel}: ${hero.card.vault}. ${hero.card.foot}`}>
            <div className="absolute -inset-3 -z-10 rotate-2 rounded-xl bg-brass-soft" aria-hidden="true" />
            <div className="rounded-xl border border-line bg-surface p-5 shadow-float" aria-hidden="true">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-h3">{hero.card.title}</p>
                <Badge tone="ok"><BadgeCheck className="size-4" />{hero.card.status}</Badge>
              </div>
              <div className="mt-4 rounded-lg bg-accent p-4 text-accent-ink">
                <p className="flex items-center gap-2 text-small font-medium opacity-90"><Landmark className="size-4" />{hero.card.vaultLabel}</p>
                <p className="mt-1 font-display text-h2">{hero.card.vault}</p>
                <p className="text-small opacity-90">{hero.card.vaultZar}</p>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {hero.card.rows.map((row, i) => {
                  const Icon = rowIcons[i];
                  return (
                    <li key={row.label} className="flex items-center gap-3 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon className="size-4.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-semibold">{row.label}</span>
                        <span className="block truncate text-small text-ink-2">{row.detail}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-small font-semibold tabular-nums">{row.amount}</span>
                        <span className="text-[0.75rem] font-semibold text-brass">{row.state}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 flex items-center gap-1.5 text-[0.8rem] text-ink-2"><ShieldCheck className="size-4 text-accent" />{hero.card.foot}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <div className="max-w-3xl">
          <Eyebrow>{problem.eyebrow}</Eyebrow>
          <h2 className="mt-3 text-h1">{problem.title}</h2>
          <p className="mt-4 text-lead text-ink-2">{problem.body}</p>
        </div>
        <dl className="mt-8 grid gap-4 md:grid-cols-3">
          {problem.stats.map((s) => (
            <div key={s.value} className="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-card">
              <dt className="order-2 mt-1 text-ink-2">{s.label}</dt>
              <dd className="font-display text-h1 text-accent">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-line/70 bg-surface-2/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
          <Eyebrow>{how.eyebrow}</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-h1">{how.title}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {how.steps.map((step, i) => {
              const Icon = stepIcons[i];
              return (
                <li key={step.title} className="relative rounded-lg border border-line bg-surface p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink"><Icon className="size-6" aria-hidden="true" /></span>
                    <span className="font-display text-h1 text-line-strong/60" aria-hidden="true">{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-h3">{step.title}</h3>
                  <p className="mt-2 text-ink-2">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 md:py-20">
        <Eyebrow>{safety.eyebrow}</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-h1">{safety.title}</h2>
        <ul className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {safety.items.map((item, i) => {
            const Icon = safetyIcons[i];
            return (
              <li key={item.title} className="flex gap-3.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon className="size-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="font-sans text-lead font-semibold tracking-normal">{item.title}</h3>
                  <p className="mt-1 text-ink-2">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Proof */}
      <section id="proof" className="scroll-mt-20 bg-accent text-accent-ink">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-small font-semibold uppercase tracking-[0.14em] opacity-80">{proof.eyebrow}</p>
            <h2 className="mt-3 text-h1">{proof.title}</h2>
            <p className="mt-4 text-lead opacity-90">{proof.body}</p>
            <p className="mt-6 rounded-md border border-current/25 p-4 text-small opacity-90">{proof.honest}</p>
          </div>
          <dl className="grid content-start gap-3">
            {proof.points.map((p) => (
              <div key={p.term} className="rounded-lg bg-surface p-4 text-ink shadow-card">
                <dt className="font-display text-h3 text-accent">{p.term}</dt>
                <dd className="mt-1 text-ink-2">{p.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="paper">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center md:py-24">
          <h2 className="text-h1">{cta.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lead text-ink-2">{cta.body}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/start" className="min-h-13! px-7">{cta.primary}<ArrowRight className="size-5" aria-hidden="true" /></ButtonLink>
            <ButtonLink href="/start?new=1" variant="secondary" className="min-h-13! px-7">{cta.secondary}</ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
