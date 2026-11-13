"use client";
/**
 * A transaction receipt. On a real network it opens Solana Explorer. In demo mode the signatures are made up, so
 * Explorer would say "not found": the receipt is shown as plain text, marked "simulated", with the reason as a tooltip.
 */
import clsx from "clsx";
import { ExternalLink } from "@/components/ui/icons";
import { useCopy } from "@/components/shell/copy";
import { explorerTx, shortAddress } from "@/lib/format";

const isDemo = () => process.env.NEXT_PUBLIC_DATA_MODE !== "chain";

export function ExplorerLink({ signature, label, srLabel, className }: { signature: string; label: string; srLabel: string; className?: string }) {
  const { common } = useCopy();
  if (isDemo()) {
    return (
      <span title={common.proof.mockNote} className={clsx("inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-ink", className)}>
        <span>{label}</span>
        <span className="font-mono text-ink-2">{shortAddress(signature, 4)}</span>
        <span className="text-ink-2 font-normal">({common.proof.simulated})</span>
        <span className="sr-only">{common.proof.mockNote}</span>
      </span>
    );
  }
  return (
    <a
      href={explorerTx(signature)}
      target="_blank"
      rel="noreferrer noopener"
      className={clsx("inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-ink underline decoration-ink decoration-1 underline-offset-4 hover:decoration-2", className)}
    >
      <span>{label}</span>
      <span className="font-mono text-ink-2">{shortAddress(signature, 4)}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{srLabel}</span>
    </a>
  );
}
