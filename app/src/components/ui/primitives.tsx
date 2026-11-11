import Link from "next/link";
import clsx from "clsx";
import { ExternalLink, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { explorerTx, formatUsdt, formatZar, shortAddress } from "@/lib/format";

/* ---------- Logo ---------- */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13" fill="var(--brand)" />
      <circle cx="24" cy="11.5" r="3.6" fill="none" stroke="var(--brand-ink)" strokeWidth="2.4" />
      <circle cx="24" cy="28" r="11.5" fill="none" stroke="var(--brand-ink)" strokeWidth="2.6" />
      <path d="M24 22.2a3.4 3.4 0 0 1 1.7 6.3l1 5h-5.4l1-5a3.4 3.4 0 0 1 1.7-6.3Z" fill="var(--mustard-400)" />
    </svg>
  );
}

export function Logo({ name, className }: { name: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8 shrink-0" />
      <span className="font-display text-[1.375rem] leading-none tracking-tight">{name}</span>
    </span>
  );
}

/* ---------- Buttons ---------- */

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-body font-medium leading-tight transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:translate-y-0 active:scale-[0.98] disabled:opacity-55 disabled:shadow-none disabled:hover:translate-y-0 disabled:active:scale-100 select-none text-center";
const btnVariants = {
  primary: "bg-accent text-accent-ink shadow-btn hover:-translate-y-px hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink shadow-card hover:border-accent hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "border border-danger text-danger bg-surface hover:bg-danger-soft",
  quiet: "bg-surface-2 text-ink hover:bg-line",
} as const;
type Variant = keyof typeof btnVariants;

export function Button({
  variant = "primary", loading = false, block = false, small = false, className, children, disabled, ...rest
}: ComponentProps<"button"> & { variant?: Variant; loading?: boolean; block?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(btnBase, btnVariants[variant], block && "w-full", small && "px-4 text-small", className)}
    >
      {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary", block = false, small = false, className, children, ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; block?: boolean; small?: boolean }) {
  return (
    <Link {...rest} className={clsx(btnBase, btnVariants[variant], block && "w-full", small && "px-4 text-small", className)}>
      {children}
    </Link>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className={clsx("rounded-lg border border-line/80 bg-surface p-4 shadow-card sm:p-5", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-small font-semibold uppercase tracking-[0.14em] text-brass", className)}>{children}</p>;
}

const badgeTones = {
  neutral: "bg-surface-2 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-brass-soft text-brass",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
  /** Mustard highlight ("Now", "Confirmed"): always dark ink on mustard. */
  gold: "gold-fill",
} as const;
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-small font-semibold", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
        <h1 className="text-h2">{title}</h1>
        {body && <p className="mt-2 text-ink-2">{body}</p>}
      </div>
      {action}
    </header>
  );
}

/* ---------- Money, proof ---------- */

export function Money({ base, rate, size = "md", className }: { base: bigint; rate?: number | null; size?: "md" | "lg" | "xl"; className?: string }) {
  return (
    <span className={clsx("inline-flex flex-col", className)}>
      <span className={clsx("font-semibold tabular-nums", size === "xl" ? "font-display text-h1 font-medium" : size === "lg" ? "text-h3" : "")}>{formatUsdt(base)}</span>
      {rate ? <span className="text-small text-ink-2 tabular-nums">≈ {formatZar(base, rate)}</span> : null}
    </span>
  );
}

export function ExplorerLink({ signature, label, srLabel, className }: { signature: string; label: string; srLabel: string; className?: string }) {
  return (
    <a
      href={explorerTx(signature)}
      target="_blank"
      rel="noreferrer noopener"
      className={clsx("inline-flex min-h-11 items-center gap-1.5 text-small font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent", className)}
    >
      <span>{label}</span>
      <span className="font-mono text-ink-2">{shortAddress(signature, 4)}</span>
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{srLabel}</span>
    </a>
  );
}

/* ---------- Progress ---------- */

export function Meter({ value, label, tone = "accent" }: { value: number; label: string; tone?: "accent" | "brass" | "danger" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="meter-track h-3 w-full overflow-hidden rounded-full"
    >
      <div
        className={clsx("h-full rounded-full transition-[width] duration-700 ease-soft", tone === "accent" ? "meter-fill" : tone === "brass" ? "bg-ember" : "bg-danger")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ---------- Forms ---------- */

export const inputClass =
  "block min-h-12 w-full rounded-md border border-line-strong bg-surface px-3.5 text-body text-ink placeholder:text-ink-2/70 shadow-[inset_0_1px_2px_rgb(92_34_24/0.06)] transition-colors hover:border-ink-2 focus:border-accent";

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-small font-semibold text-ink">{label}</label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-small text-ink-2">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-small font-medium text-danger">{error}</p>}
    </div>
  );
}

/** Required, never pre-ticked. Links to the privacy policy. */
export function Consent({ id, checked, onChange, copy }: { id: string; checked: boolean; onChange: (v: boolean) => void; copy: { before: string; link: string; after: string } }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-line bg-surface-2/60 p-3 text-small text-ink">
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
      />
      <span>
        {copy.before}{" "}
        <Link href="/privacy" target="_blank" className="font-semibold text-accent underline underline-offset-4">{copy.link}</Link>
        {copy.after}
      </span>
    </label>
  );
}

/* ---------- States ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden="true" />;
}

export function LoadingCards({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-36 w-full rounded-lg!" />
      <Skeleton className="h-24 w-full rounded-lg!" />
      <Skeleton className="h-24 w-full rounded-lg!" />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong/60 bg-[radial-gradient(60%_70%_at_50%_0%,var(--gold-soft),transparent_70%)] bg-surface/60 px-5 py-10 text-center">
      {icon && <div className="gold-fill gold-glow mb-4 grid size-14 place-items-center rounded-full">{icon}</div>}
      <h2 className="text-h3">{title}</h2>
      {body && <p className="mt-2 max-w-md text-ink-2">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "accent", icon, title, children, className }: { tone?: Tone; icon?: ReactNode; title?: string; children?: ReactNode; className?: string }) {
  const tones = {
    neutral: "border-line bg-surface-2/70",
    ok: "border-ok/30 bg-ok-soft",
    warn: "border-brass/35 bg-brass-soft",
    danger: "border-danger/50 border-l-4 border-l-danger bg-danger-soft",
    accent: "border-line border-l-4 border-l-accent bg-surface-2/60",
    gold: "border-gold-edge/40 bg-gold-soft",
  } as const;
  return (
    <div className={clsx("flex gap-3 rounded-md border p-3.5 text-ink", tones[tone], className)}>
      {icon && <span className={clsx("mt-0.5 shrink-0", tone === "danger" ? "text-danger" : tone === "warn" ? "text-brass" : tone === "ok" ? "text-ok" : "text-accent")}>{icon}</span>}
      <div className="min-w-0 text-small">
        {title && <p className="text-body font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function DefList({ items, className }: { items: { term: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={clsx("grid grid-cols-1 gap-x-6 gap-y-2 text-small sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.term} className="flex min-w-0 flex-col border-b border-line/70 pb-2">
          <dt className="text-ink-2">{it.term}</dt>
          <dd className="break-words font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
