import { landing } from "@/content/landing";
import { site } from "@/content/site";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { LandingBody } from "@/components/site/landing-body";

export default function LandingPage() {
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: site.name,
    description: site.description,
    url: site.url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "ZAR" },
  };
  return (
    <>
      <SiteHeader site={site} />
      <LandingBody copy={landing} />
      <SiteFooter site={site} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
    </>
  );
}
