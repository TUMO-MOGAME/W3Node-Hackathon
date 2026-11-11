"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { CommonCopy } from "@/content/common";
import type { AssistantCopy } from "@/content/assistant";

interface ShellCopy { common: CommonCopy; assistant: AssistantCopy; siteName: string }
const Ctx = createContext<ShellCopy | null>(null);

/** Shell copy is passed once from the server layout and shared with in-app client components. */
export function CopyProvider({ value, children }: { value: ShellCopy; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopy(): ShellCopy {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCopy must be used inside <CopyProvider>");
  return v;
}

/** Fills {placeholders} in a copy string. */
export function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ""));
}

export function timeAgo(ts: number, now: number | null, t: CommonCopy["time"]): string {
  if (!ts) return t.never;
  if (now === null) return "";
  const d = Math.max(0, now - ts);
  if (d < 60) return t.justNow;
  if (d < 3600) return fmt(t.minutes, { n: Math.floor(d / 60) });
  if (d < 86400) return fmt(t.hours, { n: Math.floor(d / 3600) });
  return fmt(t.days, { n: Math.floor(d / 86400) });
}
