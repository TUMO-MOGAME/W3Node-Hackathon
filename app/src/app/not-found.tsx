import type { Metadata } from "next";
import { site } from "@/content/site";
import { ButtonLink, Eyebrow, LogoMark } from "@/components/ui/primitives";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";

export const metadata: Metadata = { title: site.notFound.eyebrow, robots: { index: false } };

export default function NotFound() {
  const c = site.notFound;
  return (
    <>
      <SiteHeader site={site} minimal />
      <main id="main">
        <div className="mx-auto flex min-h-[60dvh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
          <LogoMark className="rise size-16" />
          <Eyebrow className="rise mt-6">{c.eyebrow} · 404</Eyebrow>
          <h1 className="rise mt-3 text-h1">{c.title}</h1>
          <p className="rise mt-4 text-lead text-ink-2">{c.body}</p>
          <div className="rise mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/">{c.home}</ButtonLink>
            <ButtonLink href="/estate" variant="secondary">{c.app}</ButtonLink>
          </div>
        </div>
      </main>
      <SiteFooter site={site} />
    </>
  );
}
