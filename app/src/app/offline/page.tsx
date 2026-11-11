import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { site } from "@/content/site";
import { Logo } from "@/components/ui/primitives";

export const metadata: Metadata = { title: site.offline.title, robots: { index: false } };

/** Served by the service worker when a page is requested without a connection. Uses a plain link so it works with no JavaScript. */
export default function OfflinePage() {
  const c = site.offline;
  return (
    <main id="main" className="paper flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <Logo name={site.name} />
      <span className="mt-10 grid size-16 place-items-center rounded-full bg-accent-soft text-accent"><WifiOff className="size-7" aria-hidden="true" /></span>
      <h1 className="mt-5 text-h1">{c.title}</h1>
      <p className="mt-3 max-w-md text-lead text-ink-2">{c.body}</p>
      <a href="/estate" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-medium text-accent-ink">{c.retry}</a>
    </main>
  );
}
