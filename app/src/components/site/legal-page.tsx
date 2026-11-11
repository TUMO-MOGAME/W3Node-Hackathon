import { Scale } from "lucide-react";
import type { LegalSection } from "@/content/legal";
import type { SiteCopy } from "@/content/site";
import { Notice } from "@/components/ui/primitives";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { LegalLanguageNote } from "./language-switcher";

export function LegalPage({ site, doc }: {
  site: SiteCopy;
  doc: { title: string; templateNotice: string; updated: string; intro: string; sections: readonly LegalSection[] };
}) {
  return (
    <>
      <SiteHeader site={site} minimal />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
        <h1 className="text-h1">{doc.title}</h1>
        <LegalLanguageNote />
        <p className="mt-2 text-small text-ink-2">{doc.updated}</p>
        <Notice tone="warn" icon={<Scale className="size-5" aria-hidden="true" />} className="mt-5">
          <p className="text-body font-medium">{doc.templateNotice}</p>
        </Notice>
        <p className="mt-6 text-lead text-ink-2">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-h3">{s.heading}</h2>
            {s.paragraphs?.map((p) => <p key={p} className="mt-3">{p}</p>)}
            {s.list && (
              <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-brass">
                {s.list.map((li) => <li key={li}>{li}</li>)}
              </ul>
            )}
          </section>
        ))}
      </main>
      <SiteFooter site={site} />
    </>
  );
}
