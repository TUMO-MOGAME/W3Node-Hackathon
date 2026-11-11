import type { Metadata } from "next";
import { privacy } from "@/content/legal";
import { site } from "@/content/site";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.intro,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage site={site} doc={privacy} />;
}
