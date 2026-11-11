"use client";
/**
 * Cookie-free language choice. Pages are rendered statically in English; in the browser the choice is
 * read from `?lang=` or localStorage, `<html lang>` is updated, and the chosen language's copy is
 * fetched as its own small chunk and laid over the English copy. English visitors download nothing extra.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Bundle } from "@/content/i18n/types";
import { DEFAULT_LOCALE, isLocale, LOCALE_TAGS, type Locale } from "./locales";
import { mergeCopy, type DeepPartial } from "./merge";

const STORAGE_KEY = "heirloom.lang";
const EVENT = "heirloom:locale";
let current: Locale | null = null;

function readInitial(): Locale {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (isLocale(q)) {
      try { window.localStorage.setItem(STORAGE_KEY, q); } catch { /* storage blocked: still honour the URL */ }
      return q;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch { /* private mode or blocked storage */ }
  return DEFAULT_LOCALE;
}

function getSnapshot(): Locale {
  if (current === null) current = readInitial();
  return current;
}
const getServerSnapshot = (): Locale => DEFAULT_LOCALE;

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && isLocale(e.newValue)) { current = e.newValue; cb(); }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", onStorage); };
}

/** Switches the whole app's language and remembers it on this device (no cookie). */
export function setLocale(locale: Locale): void {
  current = locale;
  try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
  document.documentElement.lang = LOCALE_TAGS[locale];
  void loadBundle(locale).finally(() => window.dispatchEvent(new Event(EVENT)));
}

/** The visitor's language. Always "en" during server rendering and hydration, then the real choice. */
export function useLocale(): Locale {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    const tag = LOCALE_TAGS[locale];
    if (document.documentElement.lang !== tag) document.documentElement.lang = tag;
  }, [locale]);
  return locale;
}

const bundles = new Map<Locale, Bundle>();
const loading = new Map<Locale, Promise<Bundle | null>>();

function importBundle(locale: Exclude<Locale, "en">): Promise<Bundle> {
  // One static import per language so the bundler splits each into its own chunk.
  switch (locale) {
    case "zu": return import("@/content/i18n/zu").then((m) => m.zu);
    case "st": return import("@/content/i18n/st").then((m) => m.st);
    case "af": return import("@/content/i18n/af").then((m) => m.af);
  }
}

export function loadBundle(locale: Locale): Promise<Bundle | null> {
  if (locale === "en") return Promise.resolve(null);
  const have = bundles.get(locale);
  if (have) return Promise.resolve(have);
  let p = loading.get(locale);
  if (!p) {
    p = importBundle(locale)
      .then((b) => { bundles.set(locale, b); return b; })
      .catch(() => { loading.delete(locale); return null; }); // offline: stay in English, retry next time
    loading.set(locale, p);
  }
  return p;
}

/** The current language's translations, or null for English (or while the chunk is still loading). */
export function useTranslations(): Bundle | null {
  const locale = useLocale();
  const [, setLoaded] = useState<Locale | null>(null);
  useEffect(() => {
    if (locale === "en" || bundles.has(locale)) return;
    let live = true;
    void loadBundle(locale).then(() => { if (live) setLoaded(locale); });
    return () => { live = false; };
  }, [locale]);
  return locale === "en" ? null : bundles.get(locale) ?? null;
}

/**
 * English copy (passed in as a prop) with the current language laid over it.
 * `pick` selects this component's slice of the translation, e.g. `(t) => t.screens.estate`.
 */
export function useLocalized<T>(english: T, pick: (t: Bundle) => DeepPartial<NoInfer<T>> | undefined): T {
  const t = useTranslations();
  const slice = t ? pick(t) : undefined;
  return useMemo(() => (slice === undefined ? english : mergeCopy(english, slice)), [english, slice]);
}
