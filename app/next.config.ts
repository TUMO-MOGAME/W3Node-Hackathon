import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origins the browser may talk to: our API (self), Solana RPC (devnet/mainnet or a custom RPC), ElevenLabs voice. */
function connectSrc(): string {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const rpcOrigins = rpc ? (() => { const u = new URL(rpc); return [u.origin, u.origin.replace(/^http/, "ws")]; })() : [];
  return [
    "'self'",
    "https://api.devnet.solana.com", "wss://api.devnet.solana.com",
    "https://api.mainnet-beta.solana.com", "wss://api.mainnet-beta.solana.com",
    ...rpcOrigins,
    "https://api.elevenlabs.io", "wss://api.elevenlabs.io", "wss://livekit.rtc.elevenlabs.io", "https://livekit.rtc.elevenlabs.io",
    ...(isDev ? ["ws://localhost:*", "http://127.0.0.1:8899", "ws://127.0.0.1:8900"] : []),
  ].join(" ");
}

const csp = [
  "default-src 'self'",
  // Next.js inlines bootstrap scripts; blob: is needed for ElevenLabs' audio worklets.
  `script-src 'self' 'unsafe-inline' blob:${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connectSrc()}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone for the voice agent, camera for photographing documents; everything else off.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // No "N" badge over the logo in local demo recordings (build errors still show the overlay).
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // WDK's server-side agent wallet loads the sodium-native addon; keep these out of the server bundle.
  serverExternalPackages: ["@tetherto/wdk-wallet-solana", "@tetherto/wdk-wallet", "sodium-universal", "sodium-native"],
  turbopack: {
    // Pin the project root to app/ so the resolveAlias paths below resolve the same in every build
    // (Vercel's Git builds otherwise picked the repo root and the browser shims for fs / sodium were not found).
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      // Browser build of WDK: replace the native sodium wrapper with a tiny memzero shim.
      "sodium-universal": { browser: "./src/lib/wallet/sodium-shim.ts" },
      // @anchor-lang/core's browser build references `fs` only for NodeWallet (never used in the browser).
      fs: { browser: "./src/lib/empty-module.ts" },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be served stale, or a fix to it would not reach installed apps.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
