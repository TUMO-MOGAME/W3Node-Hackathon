"use client";
import Link from "next/link";
import type { SiteCopy } from "@/content/site";
import { ButtonLink, Logo } from "@/components/ui/primitives";
import { useLocalized } from "@/lib/i18n/client";
import { LanguageSwitcher } from "./language-switcher";

/** Site chrome is shared by the landing, legal and 404 pages; English is rendered first, then the visitor's language. */

export function SiteHeader({ site: english, minimal = false }: { site: SiteCopy; minimal?: boolean }) {
  const site = useLocalized(english, (t) => t.site);
  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-ink bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2.5 focus:text-accent-ink">{site.nav.skip}</a>
      <div className="mx-auto flex h-[var(--header-h)] w-full max-w-6xl items-center gap-2 px-4 min-[400px]:gap-3">
        {/* Below 400px the wordmark gives way to the language switcher; the link keeps its accessible name. */}
        <Link href="/" aria-label={site.nav.home} className="shrink-0 rounded-full"><Logo name={site.name} className="max-[400px]:[&>span:last-child]:hidden" /></Link>
        {!minimal && (
          <nav aria-label={site.name} className="ml-6 hidden items-center gap-1 md:flex">
            {[["#how", site.nav.how], ["#safety", site.nav.safety], ["#proof", site.nav.proof]].map(([href, label]) => (
              <a key={href} href={`/${href}`} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-small font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">{label}</a>
            ))}
          </nav>
        )}
        <LanguageSwitcher className="ml-auto" />
        <ButtonLink href="/start" small className="shrink-0">{site.nav.open}</ButtonLink>
      </div>
    </header>
  );
}

export function SiteFooter({ site: english }: { site: SiteCopy }) {
  const site = useLocalized(english, (t) => t.site);
  const f = site.footer;
  return (
    <footer className="border-t border-ink bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.3fr_0.7fr_0.7fr_1.5fr]">
        <div>
          <Logo name={site.name} />
          <p className="mt-3 max-w-sm text-small text-ink-2">{f.blurb}</p>
          <p className="mt-4 inline-flex rounded-full border border-ink px-3 py-1.5 text-small font-semibold">{f.builtWith}</p>
          <p className="mt-3 text-small text-ink-2">{f.program}:{" "}<a href={`https://explorer.solana.com/address/${f.programId}?cluster=devnet`} target="_blank" rel="noreferrer noopener" className="break-all font-mono text-ink underline underline-offset-4">{f.programId}</a></p>
        </div>
        <nav aria-label={f.linksTitle}>
          <h2 className="font-sans text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{f.linksTitle}</h2>
          <ul className="mt-2">
            {f.links.map((l) => (
              <li key={l.href}><Link href={l.href} className="inline-flex min-h-11 items-center text-small font-medium underline-offset-4 hover:underline">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label={f.legalTitle}>
          <h2 className="font-sans text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{f.legalTitle}</h2>
          <ul className="mt-2">
            {f.legal.map((l) => (
              <li key={l.href}><Link href={l.href} className="inline-flex min-h-11 items-center text-small font-medium underline-offset-4 hover:underline">{l.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="font-sans text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{f.ectaTitle}</h2>
          <dl className="mt-3 grid gap-1.5 text-small">
            {f.ecta.map((row) => (
              <div key={row.term} className="grid grid-cols-[9.5rem_1fr] gap-2 max-[380px]:grid-cols-1 max-[380px]:gap-0">
                <dt className="text-ink-2">{row.term}</dt>
                <dd className="break-words font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="pb-safe border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-small text-ink-2">© 2026 {f.rights}</p>
      </div>
    </footer>
  );
}
