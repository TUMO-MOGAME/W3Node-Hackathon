import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { site } from "@/content/site";
import { ServiceWorker } from "@/components/shell/service-worker";
import "./globals.css";

// next/font downloads these at build time and serves them from our own origin (no font CDN at runtime).
const display = Fraunces({ variable: "--font-display-face", subsets: ["latin"], display: "swap", axes: ["opsz"] });
const body = Geist({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, title: site.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: { type: "website", siteName: site.name, title: site.title, description: site.description, url: "/", locale: "en_ZA" },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: site.themeLight },
    { media: "(prefers-color-scheme: dark)", color: site.themeDark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
