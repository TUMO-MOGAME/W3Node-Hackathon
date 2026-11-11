/*
 * Heirloom service worker. Deliberately small.
 * - Caches the app shell (offline page, icons) and immutable build assets.
 * - Pages are network-first so estate data is never stale; offline falls back to the offline page.
 * - NEVER caches API routes, RPC calls, cross-origin requests, or anything that is not a GET.
 */
const VERSION = "heirloom-v4";
const SHELL = ["/offline", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/fonts/uicons-rr-subset.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Solana RPC, exchange rates, voice: always live
  if (url.pathname.startsWith("/api/")) return; // agent and data routes: always live
  if (req.headers.has("rsc") || url.searchParams.has("_rsc")) return; // framework data requests

  // Hashed build assets and icons: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  // The icon font keeps its name across rebuilds, so network first (fresh glyphs), cache for offline.
  if (url.pathname.startsWith("/fonts/")) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Page navigations: network first, then the offline page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline").then((hit) => hit || Response.error())));
  }
});
