import type { MetadataRoute } from "next";
import { site } from "@/content/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${site.name}: ${site.tagline}`,
    short_name: site.shortName,
    description: site.description,
    lang: "en-ZA",
    start_url: "/estate",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: site.themeLight,
    theme_color: site.themeLight,
    categories: ["finance", "lifestyle"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Estate", url: "/estate" },
      { name: "Claims", url: "/claims" },
      { name: "Inbox", url: "/inbox" },
    ],
  };
}
