"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { ShieldX } from "@/components/ui/icons";
import { useCopy } from "./copy";

/** Shown when the estate's on-chain rules refuse an action. Makes the refusal visible and explains it. */
export function Blocked({ code, message, children }: { code: string; message: string; children?: ReactNode }) {
  const { common } = useCopy();
  const b = common.blocked;
  const ref = useRef<HTMLDivElement>(null);
  // A refusal must never be missed below the fold.
  useEffect(() => { ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [code, message]);
  return (
    <motion.div
      ref={ref}
      role="alert"
      initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }} transition={{ duration: 0.45 }}
      className="rounded-lg border-2 border-l-[10px] border-ink bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[3px] bg-ink text-bg"><ShieldX className="size-6" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="inline-block rounded-[3px] bg-ink px-2 py-0.5 text-small font-bold uppercase tracking-[0.12em] text-bg">{b.title}</p>
          <p className="mt-1.5 text-lead font-semibold">{message}</p>
          <p className="mt-1 text-small text-ink-2">{b.body}</p>
          {code !== "generic" && <p className="mt-2 text-[0.75rem] text-ink-2">{b.code}: <span className="font-mono font-semibold text-ink">{code}</span></p>}
          {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
        </div>
      </div>
    </motion.div>
  );
}
