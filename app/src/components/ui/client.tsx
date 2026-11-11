"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, FileCheck2, FileUp, Info, X } from "lucide-react";
import { useEstate } from "@/lib/hooks/estate";

/* ---------- Sheet: bottom sheet on phones, side panel on desktop (native <dialog>) ---------- */

export function Sheet({
  open, onClose, title, description, closeLabel, children, footer, tall = false, headerExtra,
}: {
  open: boolean; onClose: () => void; title: string; description?: string; closeLabel: string;
  children: ReactNode; footer?: ReactNode; tall?: boolean; headerExtra?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); if (!(document.activeElement instanceof HTMLInputElement)) d.querySelector<HTMLElement>("[data-sheet-title]")?.focus(); }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={clsx("sheet", tall && "sheet-tall")}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <>
          <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 pb-3 pt-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} data-sheet-title tabIndex={-1} className="text-h3 outline-none">{title}</h2>
              {description && <p className="mt-1 text-small text-ink-2">{description}</p>}
            </div>
            {headerExtra}
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-1.5 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
          {footer && <div className="pb-safe shrink-0 border-t border-line bg-surface px-4 pt-3 sm:px-5"><div className="pb-3">{footer}</div></div>}
        </>
      )}
    </dialog>
  );
}

/* ---------- Toaster ---------- */

export function Toaster({ dismissLabel }: { dismissLabel: string }) {
  const { toasts, dismiss } = useEstate();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-b)+0.75rem)] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite" aria-atomic="false">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            className={clsx(
              "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md border border-l-4 bg-surface p-3 pr-1.5 text-small shadow-raised",
              t.tone === "error" ? "border-danger/50 border-l-danger" : t.tone === "ok" ? "border-ok/40 border-l-ok" : "border-line border-l-gold-edge",
            )}
          >
            <span className={clsx("mt-0.5 shrink-0", t.tone === "error" ? "text-danger" : t.tone === "ok" ? "text-ok" : "text-accent")}>
              {t.tone === "error" ? <CircleAlert className="size-5" aria-hidden="true" /> : t.tone === "ok" ? <Check className="size-5" aria-hidden="true" /> : <Info className="size-5" aria-hidden="true" />}
            </span>
            <p className="min-w-0 flex-1 py-0.5 font-medium">{t.text}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label={dismissLabel} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
              <X className="size-4" aria-hidden="true" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Quorum: dots that fill as trusted people approve ---------- */

export function Quorum({ approvals, needed, names, label }: { approvals: boolean[]; needed: number; names?: readonly string[]; label: string }) {
  const got = approvals.filter(Boolean).length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" role="group" aria-label={label}>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {approvals.map((on, i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{ scale: on ? [1, 1.25, 1] : 1 }}
            transition={{ duration: 0.45 }}
            title={names?.[i]}
            className={clsx("grid size-7 place-items-center rounded-full border-2 text-[0.7rem] font-bold", on ? "border-gold-edge bg-gold text-gold-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_30%,transparent)]" : "border-line-strong/70 bg-surface text-ink-2")}
          >
            {on ? <Check className="size-4" /> : (names?.[i]?.replace(/^(Adv\.|Ms\.|Mr\.|Uncle|Aunt|Pastor)\s+/i, "")[0] ?? i + 1)}
          </motion.span>
        ))}
      </div>
      <span className="text-small font-semibold tabular-nums">{label}</span>
      {got >= needed && <span className="sr-only">✓</span>}
    </div>
  );
}

/* ---------- Typewriter: streaming feel for agent replies ---------- */

export function Typewriter({ text, active, onDone, onTick }: { text: string; active: boolean; onDone?: () => void; onTick?: () => void }) {
  const reduced = useReducedMotion();
  const animate = active && !reduced;
  const [n, setN] = useState(animate ? 0 : text.length);
  const done = useRef(!animate);
  useEffect(() => {
    if (!animate) { setN(text.length); if (!done.current) { done.current = true; onDone?.(); } return; }
    const step = Math.max(2, Math.round(text.length / 110));
    const id = window.setInterval(() => {
      setN((prev) => {
        const next = Math.min(text.length, prev + step);
        if (next >= text.length) {
          window.clearInterval(id);
          if (!done.current) { done.current = true; window.setTimeout(() => onDone?.(), 0); }
        }
        return next;
      });
      onTick?.();
    }, 22);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);
  const typing = n < text.length;
  return (
    <>
      <span aria-hidden={typing || undefined} className={clsx("whitespace-pre-line", typing && "typing-caret")}>{text.slice(0, n)}</span>
      {typing && <span className="sr-only">{text}</span>}
    </>
  );
}

/* ---------- File picker with sample documents (so the demo never needs real papers) ---------- */

export interface SampleDoc { label: string; fileName: string }

export function FilePicker({
  id, label, hint, file, onFile, samples, copy, accept = "application/pdf,image/*",
}: {
  id: string; label: string; hint?: string; file: File | null; onFile: (f: File | null) => void; samples?: readonly SampleDoc[];
  copy: { choose: string; change: string; samplesLabel: string; chosen: string };
  accept?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-small font-semibold">{label}</span>
      <label
        htmlFor={id}
        className={clsx(
          "flex min-h-20 cursor-pointer items-center gap-3 rounded-md border-2 border-dashed p-3.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]",
          file ? "border-accent/60 bg-accent-soft" : "border-line-strong/70 bg-surface hover:bg-surface-2",
        )}
      >
        <span className={clsx("grid size-11 shrink-0 place-items-center rounded-full", file ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2")}>
          {file ? <FileCheck2 className="size-5" aria-hidden="true" /> : <FileUp className="size-5" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1 text-small">
          <span className="block truncate text-body font-semibold">{file ? file.name : copy.choose}</span>
          <span className="text-ink-2">{file ? copy.change : hint}</span>
        </span>
        <input
          id={id}
          type="file"
          accept={accept}
          aria-labelledby={`${id}-label`}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <p className="sr-only" role="status">{file ? `${copy.chosen} ${file.name}` : ""}</p>
      {samples && samples.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small text-ink-2">{copy.samplesLabel}</span>
          {samples.map((s) => (
            <button
              key={s.fileName}
              type="button"
              onClick={() => onFile(new File([`Heirloom demo document: ${s.fileName}`], s.fileName, { type: "application/pdf" }))}
              className={clsx("min-h-11 rounded-full border px-3.5 text-small font-medium", file?.name === s.fileName ? "border-accent bg-accent-soft text-accent" : "border-line-strong/70 bg-surface hover:bg-surface-2")}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
