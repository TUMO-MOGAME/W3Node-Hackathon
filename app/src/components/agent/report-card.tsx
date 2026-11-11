"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { motion } from "motion/react";
import { Check, Loader2, ScanSearch, TriangleAlert } from "@/components/ui/icons";
import type { AgentReport } from "@/lib/types";
import { shortAddress } from "@/lib/format";
import { Badge, DefList } from "@/components/ui/primitives";
import { useCopy } from "@/components/shell/copy";

/** The agent's reading of a document: summary, extracted fields, red flags and confidence. */
export function ReportCard({ report, compact = false }: { report: AgentReport; compact?: boolean }) {
  const { common } = useCopy();
  const c = common.report;
  const tone = report.verdict === "approve" ? "ok" : report.verdict === "reject" ? "danger" : "warn";
  const pct = Math.round(report.confidence * 100);
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      aria-label={c.title}
      className={clsx("rounded-lg bg-surface p-4", tone === "ok" ? "border-[1.5px] border-ink" : tone === "danger" ? "border-2 border-l-8 border-ink" : "border-[1.5px] border-dashed border-ink")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-bg"><ScanSearch className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-body font-semibold tracking-normal">{c.title}</h3>
          <p className="text-small text-ink-2">{c.docTypes[report.documentType] ?? report.documentType} · {c.by}</p>
        </div>
        <Badge tone={tone}>
          {c.verdict[report.verdict]}
        </Badge>
      </div>

      <p className="mt-3">{report.summary}</p>

      <div className="mt-3 flex items-center gap-3">
        <span className="shrink-0 text-small text-ink-2">{c.confidence}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={c.confidence} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <motion.div
            className="h-full rounded-full bg-ink"
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span className="shrink-0 text-small font-semibold tabular-nums">{pct}%</span>
      </div>

      {report.redFlags.length > 0 ? (
        <div className="mt-3 rounded-md border-2 border-l-8 border-ink bg-surface p-3">
          <p className="flex items-center gap-1.5 text-small font-bold uppercase tracking-wide text-ink"><TriangleAlert className="size-4" aria-hidden="true" />{c.redFlags}</p>
          <ul className="mt-1 list-disc pl-5 text-small">
            {report.redFlags.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-small font-medium text-ink"><Check className="size-4" strokeWidth={3} aria-hidden="true" />{c.noRedFlags}</p>
      )}

      {!compact && Object.keys(report.extracted).length > 0 && (
        <details className="group mt-3" open>
          <summary className="flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink underline underline-offset-4">{c.extracted}</summary>
          <DefList items={Object.entries(report.extracted).map(([term, value]) => ({ term, value }))} />
        </details>
      )}

      <p className="mt-3 text-[0.75rem] text-ink-2">
        {c.advisory} · {c.hash}: <span className="font-mono">{shortAddress(report.reportHash, 6)}</span>
      </p>
    </motion.section>
  );
}

/** Shown while the agent reads an upload. Announces progress politely. */
export function Reviewing() {
  const { common } = useCopy();
  const c = common.report;
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => Math.min(c.reviewingSteps.length - 1, x + 1)), 520);
    return () => window.clearInterval(id);
  }, [c.reviewingSteps.length]);
  return (
    <div role="status" aria-live="polite" className="rounded-lg border-[1.5px] border-dashed border-ink bg-surface p-4">
      <p className="flex items-center gap-2 font-semibold"><Loader2 className="size-5 animate-spin" aria-hidden="true" />{c.reviewing}</p>
      <ol className="mt-3 flex flex-col gap-1.5 text-small">
        {c.reviewingSteps.map((step, n) => (
          <li key={step} className={clsx("flex items-center gap-2 transition-opacity", n > i ? "opacity-40" : "opacity-100")} aria-hidden={n !== i}>
            {n < i ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : <span className={clsx("mx-1 size-2 rounded-full", n === i ? "animate-pulse-soft bg-ink" : "bg-line-strong")} />}
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
