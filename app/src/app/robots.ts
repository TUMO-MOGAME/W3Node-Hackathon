import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      // In-app screens are personal and have nothing for a search engine.
      disallow: ["/api/", "/estate", "/will", "/vault", "/car", "/people", "/family", "/claims", "/hardship", "/inbox", "/send", "/offline"],
    }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
