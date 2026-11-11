"use client";
/**
 * "Needs your attention" cards on the chat home. One card shows at a time; with several, they rotate
 * slowly (never under reduced motion, and never while hovered or focused) and can be paused or stepped by hand.
 */
import { useEffect, useState } from "react";
import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { BellRing, ChevronLeft, ChevronRight, Clock, Info, Pause, Play, X } from "@/components/ui/icons";
import type { Nudge } from "@/lib/chat/types";
import { useEstate } from "@/lib/hooks/estate";
import { usePay } from "@/components/pay/payment";
import { usePerformAction } from "@/components/agent/chat-parts";
import { Button } from "@/components/ui/primitives";
import { fmt, useCopy } from "@/components/shell/copy";
import { useAttention } from "./chat-context";

const ROTATE_MS = 8000;
const iconBtn = "grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-surface-2";

export function NudgeStack({ className }: { className?: string }) {
  const { assistant } = useCopy();
  const c = assistant.home.nudges;
  const { nudges, dismiss } = useAttention();
  const { snap, run, busy } = useEstate();
  const { pay } = usePay();
  const perform = usePerformAction();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const total = nudges.length;
  const rotating = total > 1 && !paused && !held && !reduced;

  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotating]);

  if (total === 0) return null;
  const at = ((index % total) + total) % total;
  const n = nudges[at];

  const primary = (x: Nudge) => {
    const a = x.primary.action;
    if (a.type !== "run") { perform(a); return; }
    if (a.op === "finalizeUnlock") { void run("unlock", (svc, est) => svc.finalizeUnlock(est), c.unlocked); return; }
    // Money moves: always through the payment review, never straight from the card.
    const rule = snap?.rules.find((r) => r.address === a.target);
    if (!snap || !rule) return;
    const payee = snap.payees.find((p) => p.wallet === rule.fixedPayee)?.name ?? "";
    void pay({
      kind: "scheduled", source: "vault", to: rule.fixedPayee ?? "", toLabel: payee, amount: rule.recurringAmount,
      execute: (svc, est) => svc.executeScheduled(est, rule.address), successText: fmt(c.paid, { payee }),
    });
  };

  const Icon = n.urgency === "now" ? BellRing : n.urgency === "soon" ? Clock : Info;

  return (
    <section
      aria-label={c.label} aria-roledescription="carousel" className={className}
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}
    >
      <motion.div
        key={n.id} role="group" aria-roledescription="slide" aria-label={total > 1 ? fmt(c.position, { n: at + 1, total }) : undefined}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        // Urgency is carried by the rule style, the icon and the word: heavy for now, dashed for soon, hairline otherwise.
        className={clsx("rounded-xl bg-surface p-4 shadow-raised", n.urgency === "now" ? "border-2 border-ink" : n.urgency === "soon" ? "border-[1.5px] border-dashed border-ink" : "border border-line-strong")}
      >
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className={clsx("grid size-10 shrink-0 place-items-center rounded-full", n.urgency === "now" ? "bg-ink text-bg" : "border border-ink text-ink")}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-2">{c.label} · {c.urgency[n.urgency]}</p>
            <p role="heading" aria-level={2} className="mt-0.5 font-semibold">{n.title}</p>
          </div>
          <button type="button" onClick={() => dismiss(n.id)} aria-label={c.close} title={c.close} className={clsx(iconBtn, "-mr-2 -mt-2 text-ink-2")}>
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-small text-ink-2 sm:pl-[3.25rem]">{n.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-[3.25rem]">
          <Button small disabled={!!busy} onClick={() => primary(n)}>{n.primary.label}</Button>
          {n.secondary && <Button small variant="secondary" onClick={() => dismiss(n.id)}>{n.secondary.label}</Button>}
        </div>
      </motion.div>

      {total > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1">
          <button type="button" onClick={() => setIndex(at - 1)} aria-label={fmt(c.show, { n: ((at - 1 + total) % total) + 1, total })} className={iconBtn}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <span className="flex items-center gap-1.5" aria-hidden="true">
            {nudges.map((x, i) => <span key={x.id} className={clsx("h-2 rounded-full transition-[width]", i === at ? "w-5 bg-ink" : "w-2 border border-ink")} />)}
          </span>
          <span className="sr-only" role="status">{fmt(c.position, { n: at + 1, total })}</span>
          <button type="button" onClick={() => setIndex(at + 1)} aria-label={fmt(c.show, { n: ((at + 1) % total) + 1, total })} className={iconBtn}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          {!reduced && (
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? c.play : c.pause} title={paused ? c.play : c.pause} className={iconBtn}>
              {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
