import type { Metadata } from "next";
import { terms } from "@/content/legal";
import { site } from "@/content/site";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: terms.title,
  description: terms.intro,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage site={site} doc={terms} />;
}
