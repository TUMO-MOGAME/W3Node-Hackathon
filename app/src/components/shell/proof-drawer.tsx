"use client";
import { useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import { formatUsdt, shortAddress } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { useNow } from "@/lib/hooks/use-now";
import { Sheet } from "@/components/ui/client";
import { ExplorerLink, Notice } from "@/components/ui/primitives";
import { timeAgo, useCopy } from "./copy";

function CopyValue({ value, copyLabel, copiedLabel }: { value: string; copyLabel: string; copiedLabel: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); window.setTimeout(() => setDone(false), 1600); } catch { /* clipboard blocked */ }
      }}
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md text-left font-mono text-small hover:bg-surface-2"
    >
      <span className="truncate">{shortAddress(value, 8)}</span>
      {done ? <Check className="size-4 shrink-0 text-ok" aria-hidden="true" /> : <Copy className="size-4 shrink-0 text-ink-2" aria-hidden="true" />}
      <span className="sr-only" role="status">{done ? copiedLabel : copyLabel}</span>
    </button>
  );
}

/** Every on-chain transaction for this estate, one tap away from any screen. */
export function ProofDrawer() {
  const { common } = useCopy();
  const c = common.proof;
  const { proofOpen, setProofOpen, snap, isMock } = useEstate();
  const now = useNow(15000);
  const e = snap?.estate;
  const facts = e ? [
    { term: c.facts.estate, value: e.address },
    { term: c.facts.will, value: e.willHash },
    { term: c.facts.mint, value: e.usdtMint },
    { term: c.facts.agent, value: e.agent },
  ] : [];
  return (
    <Sheet open={proofOpen} onClose={() => setProofOpen(false)} title={c.title} description={c.body} closeLabel={c.close} tall>
      <div className="flex flex-col gap-4">
        {isMock && <Notice tone="warn" icon={<Info className="size-5" aria-hidden="true" />}>{c.mockNote}</Notice>}
        {e && (
          <dl className="rounded-lg border border-line bg-surface-2/50 px-3.5 py-1">
            {facts.map((f) => (
              <div key={f.term} className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line/70 py-1 last:border-0">
                <dt className="text-small text-ink-2">{f.term}</dt>
                <dd className="min-w-0">{f.value ? <CopyValue value={f.value} copyLabel={c.copy} copiedLabel={c.copied} /> : <span className="text-small">{c.notSigned}</span>}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-small text-ink-2">{c.facts.network}</dt>
              <dd className="text-small font-medium">{c.network}</dd>
            </div>
          </dl>
        )}
        {!snap || snap.activity.length === 0 ? (
          <p className="py-8 text-center text-ink-2">{c.empty}</p>
        ) : (
          <ol className="flex flex-col">
            {snap.activity.map((a, i) => (
              <li key={`${a.txSignature}-${i}`} className="border-b border-line/70 py-2.5 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-small font-medium">{a.text}</p>
                  {a.amount !== undefined && <span className="shrink-0 text-small font-semibold tabular-nums">{formatUsdt(a.amount, { decimals: 0 })}</span>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <span className="text-[0.75rem] text-ink-2"><span className="font-mono">{a.kind}</span> · {timeAgo(a.ts, now, common.time)}</span>
                  {a.txSignature && <ExplorerLink signature={a.txSignature} label={c.receipt} srLabel={c.receiptSr} />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Sheet>
  );
}
