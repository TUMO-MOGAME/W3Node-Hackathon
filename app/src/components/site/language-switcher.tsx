"use client";
import { useId } from "react";
import clsx from "clsx";
import { Languages } from "lucide-react";
import { setLocale, useLocale, useTranslations } from "@/lib/i18n/client";
import { isLocale, LANGUAGE_LABEL, LOCALE_NAMES, LOCALE_TAGS, LOCALES } from "@/lib/i18n/locales";

/**
 * Language picker. `compact` is a native select for headers (fits a 360px screen; the label is read
 * out by screen readers); `list` is a row of choices with a visible label, for the persona sheet.
 * Each option carries its own `lang` so it is pronounced correctly.
 */
export function LanguageSwitcher({ variant = "compact", className }: { variant?: "compact" | "list"; className?: string }) {
  const locale = useLocale();
  const id = useId();

  if (variant === "list") {
    return (
      <fieldset className={className}>
        <legend className="mb-2 text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{LANGUAGE_LABEL}</legend>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1 min-[420px]:grid-cols-4">
          {LOCALES.map((l) => (
            <label key={l} lang={LOCALE_TAGS[l]} className={clsx("flex min-h-11 cursor-pointer items-center justify-center rounded-full px-2 text-small font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", locale === l ? "bg-surface shadow-card" : "text-ink-2")}>
              <input type="radio" name={`${id}-lang`} value={l} checked={locale === l} onChange={() => setLocale(l)} className="sr-only" />
              {LOCALE_NAMES[l]}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className={clsx("relative inline-flex shrink-0 items-center", className)}>
      <label htmlFor={id} className="sr-only">{LANGUAGE_LABEL}</label>
      <Languages className="pointer-events-none absolute left-2.5 size-4 text-ink-2" aria-hidden="true" />
      <select
        id={id} value={locale} title={LANGUAGE_LABEL}
        onChange={(e) => { if (isLocale(e.target.value)) setLocale(e.target.value); }}
        className="min-h-11 max-w-[8.5rem] cursor-pointer appearance-none rounded-full border border-line-strong/60 bg-surface py-1 pl-8 pr-3 text-small font-semibold text-ink hover:bg-surface-2"
      >
        {LOCALES.map((l) => <option key={l} value={l} lang={LOCALE_TAGS[l]}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </div>
  );
}

/** Legal pages stay in English (they are templates for legal review); other languages get one line saying so. */
export function LegalLanguageNote() {
  const t = useTranslations();
  const locale = useLocale();
  if (!t) return null;
  return <p lang={LOCALE_TAGS[locale]} className="mt-3 rounded-md border border-line bg-surface-2/60 px-3 py-2 text-small text-ink-2">{t.legalNote}</p>;
}
