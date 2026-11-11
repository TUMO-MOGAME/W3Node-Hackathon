import Link from "next/link";
import clsx from "clsx";
import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";
import { Check, CircleDashed, ExternalLink, Loader2, TriangleAlert } from "@/components/ui/icons";
import { explorerTx, formatUsdt, formatZar, shortAddress } from "@/lib/format";

/* ---------- Logo ---------- */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13" fill="var(--ink)" />
      <circle cx="24" cy="11.5" r="3.6" fill="none" stroke="var(--bg)" strokeWidth="2.4" />
      <circle cx="24" cy="28" r="11.5" fill="none" stroke="var(--bg)" strokeWidth="2.6" />
      <path d="M24 22.2a3.4 3.4 0 0 1 1.7 6.3l1 5h-5.4l1-5a3.4 3.4 0 0 1 1.7-6.3Z" fill="var(--bg)" />
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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-body font-medium leading-tight border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:opacity-55 disabled:active:scale-100 select-none text-center";
const btnVariants = {
  primary: "border-accent bg-accent text-accent-ink hover:border-accent-hover hover:bg-accent-hover",
  secondary: "border-ink bg-surface text-ink hover:bg-surface-2",
  ghost: "border-transparent text-ink hover:bg-surface-2",
  danger: "border-2 border-ink bg-surface text-ink hover:bg-surface-2",
  quiet: "border-transparent bg-surface-2 text-ink hover:bg-line",
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
    <div {...rest} className={clsx("rounded-lg border border-line bg-surface p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-small font-semibold uppercase tracking-[0.14em] text-ink", className)}>{children}</p>;
}

/**
 * Status without colour. Each tone has its own shape, and ok / warn / danger carry a default icon
 * (used unless the caller passes its own), so a badge reads at a glance and never relies on colour.
 */
const badgeTones = {
  /** Quiet label: thin grey outline. */
  neutral: "rounded-full border border-line-strong bg-surface text-ink-2",
  /** Success: solid outline with a filled tick. */
  ok: "rounded-full border-[1.5px] border-ink bg-surface text-ink",
  /** Pending / caution: dashed outline. */
  warn: "rounded-full border-[1.5px] border-dashed border-ink bg-surface text-ink",
  /** Blocked / rejected: solid inverted block with square corners. */
  danger: "rounded-[3px] border border-ink bg-ink text-bg uppercase tracking-wide",
  /** Informational: solid hairline outline. */
  accent: "rounded-full border border-ink bg-surface text-ink",
  /** Highlight ("Now", "Confirmed"): solid inverted pill. */
  gold: "rounded-full border border-ink bg-ink text-bg",
} as const;
export type Tone = keyof typeof badgeTones;

/** A filled tick: a solid disc in the ink colour with the tick knocked out. */
export function TickDisc({ className }: { className?: string }) {
  return (
    <span className={clsx("grid size-4 shrink-0 place-items-center rounded-full bg-ink text-bg", className)} aria-hidden="true">
      <Check className="size-[70%]" strokeWidth={3.5} />
    </span>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const hasIcon = Children.toArray(children).some(isValidElement);
  return (
    <span className={clsx("inline-flex min-h-6 items-center gap-1 whitespace-nowrap px-2.5 text-small font-semibold", badgeTones[tone], className)}>
      {!hasIcon && tone === "ok" && <TickDisc />}
      {!hasIcon && tone === "warn" && <CircleDashed className="size-3.5 shrink-0" aria-hidden="true" />}
      {!hasIcon && tone === "danger" && <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />}
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
      className={clsx("inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-ink underline decoration-ink decoration-1 underline-offset-4 hover:decoration-2", className)}
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
        data-tone={tone}
        className="meter-fill h-full rounded-full transition-[width] duration-700 ease-soft"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ---------- Forms ---------- */

export const inputClass =
  "block min-h-12 w-full rounded-md border border-line-strong bg-surface px-3.5 text-body text-ink placeholder:text-ink-2 transition-colors hover:border-ink focus:border-ink";

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-small font-semibold text-ink">{label}</label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-small text-ink-2">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="flex items-start gap-1.5 text-small font-semibold text-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</p>}
    </div>
  );
}

/** Required, never pre-ticked. Links to the privacy policy. */
export function Consent({ id, checked, onChange, copy }: { id: string; checked: boolean; onChange: (v: boolean) => void; copy: { before: string; link: string; after: string } }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-line-strong bg-surface p-3 text-small text-ink">
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
        <Link href="/privacy" target="_blank" className="font-semibold text-ink underline underline-offset-4">{copy.link}</Link>
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
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-5 py-10 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-full bg-ink text-bg">{icon}</div>}
      <h2 className="text-h3">{title}</h2>
      {body && <p className="mt-2 max-w-md text-ink-2">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "accent", icon, title, children, className }: { tone?: Tone; icon?: ReactNode; title?: string; children?: ReactNode; className?: string }) {
  const tones = {
    /** Quiet aside: grey panel, no rule. */
    neutral: "border border-line bg-surface-2",
    /** Success: solid outline, filled tick. */
    ok: "border-[1.5px] border-ink bg-surface",
    /** Caution / pending: dashed outline, warning icon. */
    warn: "border-[1.5px] border-dashed border-ink bg-surface",
    /** Danger: heavy outline with a thick left rule, warning icon in a solid block. */
    danger: "border-2 border-l-8 border-ink bg-surface",
    /** Information: hairline outline with a medium left rule. */
    accent: "border border-l-4 border-line-strong border-l-ink bg-surface",
    /** Highlight: solid outline on grey. */
    gold: "border-2 border-ink bg-surface-2",
  } as const;
  const mark = icon ?? (tone === "warn" || tone === "danger" ? <TriangleAlert className="size-5" aria-hidden="true" /> : tone === "ok" ? <TickDisc className="size-5" /> : null);
  return (
    <div className={clsx("flex gap-3 rounded-md p-3.5 text-ink", tones[tone], className)}>
      {mark && <span className={clsx("shrink-0", tone === "danger" ? "-my-0.5 grid size-8 place-items-center self-start rounded-[3px] bg-ink text-bg" : "mt-0.5 text-ink")}>{mark}</span>}
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
        <div key={it.term} className="flex min-w-0 flex-col border-b border-line pb-2">
          <dt className="text-ink-2">{it.term}</dt>
          <dd className="break-words font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
