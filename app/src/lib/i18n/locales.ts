/**
 * The languages Heirloom speaks. Shared by the browser (switcher, copy) and the server (agent prompts),
 * so it holds no React and no browser APIs. English is the default and the source of truth for copy.
 */
export const LOCALES = ["en", "zu", "st", "af"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language named in itself, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zu: "isiZulu",
  st: "Sesotho",
  af: "Afrikaans",
};

/** BCP 47 tags for `<html lang>` and `lang` attributes (South African variants). */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-ZA",
  zu: "zu-ZA",
  st: "st-ZA",
  af: "af-ZA",
};

/** English names, for instructing the agent which language to reply in. */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  en: "South African English",
  zu: "isiZulu",
  st: "Sesotho (Southern Sotho, as spoken in South Africa)",
  af: "Afrikaans",
};

/** The switcher's label names itself in every language so anyone can find it. */
export const LANGUAGE_LABEL = "Language / Ulimi / Puo / Taal";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
