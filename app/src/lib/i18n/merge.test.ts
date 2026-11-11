import { describe, expect, it } from "vitest";
import { landing } from "@/content/landing";
import { common } from "@/content/common";
import { screens } from "@/content/screens";
import { pay } from "@/content/pay";
import { assistant } from "@/content/assistant";
import { af } from "@/content/i18n/af";
import { st } from "@/content/i18n/st";
import { zu } from "@/content/i18n/zu";
import { mergeCopy } from "./merge";
import { isLocale } from "./locales";

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

/** Walks English and a translation side by side, yielding every translated string with its English original. */
function* pairs(en: unknown, tr: unknown, path = ""): Generator<[string, string, string]> {
  if (typeof en === "string" && typeof tr === "string") { yield [path, en, tr]; return; }
  if (en && tr && typeof en === "object" && typeof tr === "object") {
    for (const k of Object.keys(tr)) yield* pairs((en as Record<string, unknown>)[k], (tr as Record<string, unknown>)[k], `${path}.${k}`);
  }
}

describe("mergeCopy", () => {
  it("lays a partial translation over English and keeps untranslated slots", () => {
    const out = mergeCopy(screens.estate, af.screens.estate);
    expect(out.eyebrow).toBe("Boedel");
    expect(out.rate).toBe(screens.estate.rate);
    expect(out.scheduled.forWho).toBe(screens.estate.scheduled.forWho);
  });
  it("ignores empty strings and arrays of the wrong length", () => {
    expect(mergeCopy({ a: "x", b: ["1", "2"] }, { a: "", b: ["only"] })).toEqual({ a: "x", b: ["1", "2"] });
  });
  it("recognises the four locales only", () => {
    expect(["en", "zu", "st", "af"].every(isLocale)).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});

describe.each([["af", af], ["st", st], ["zu", zu]] as const)("%s translation", (_name, t) => {
  it("keeps every {placeholder} of the English copy", () => {
    const english = { landing, common, screens, pay, assistant };
    const translated = { landing: t.landing, common: t.common, screens: t.screens, pay: t.pay, assistant: t.assistant };
    for (const [path, en, tr] of pairs(english, translated)) expect(placeholders(tr), path).toBe(placeholders(en));
  });

  it("translates the whole sidebar and chat home (only the agent-read drafts stay English)", () => {
    const missing: string[] = [];
    const walk = (en: unknown, tr: unknown, path: string) => {
      if (/composer\.(sendMoneyDraft|defaultMessage)/.test(path)) return;
      if (typeof en === "string") { if (typeof tr !== "string" || !tr) missing.push(path); return; }
      if (en && typeof en === "object") for (const k of Object.keys(en)) walk((en as Record<string, unknown>)[k], (tr as Record<string, unknown> | undefined)?.[k], `${path}.${k}`);
    };
    walk(assistant.shell, t.assistant.shell, "shell");
    walk(assistant.home, t.assistant.home, "home");
    expect(missing).toEqual([]);
  });
});
