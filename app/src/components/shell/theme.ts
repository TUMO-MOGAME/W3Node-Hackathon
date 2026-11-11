"use client";
/** Appearance choice (system, light or dark), shared by the sidebar toggle and the persona sheet. Remembered on this device. */
import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";
const KEY = "heirloom.theme";
const EVENT = "heirloom:theme";

function read(): Theme {
  try {
    const t = window.localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch { return "system"; }
}

const prefersDark = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;

function subscribe(cb: () => void): () => void {
  const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  mq?.addEventListener("change", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); mq?.removeEventListener("change", cb); };
}

/** Applies a theme choice to the page (system is the default and needs no attribute). */
export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === "system") delete root.dataset.theme;
  else root.dataset.theme = t;
}

export function setTheme(t: Theme): void {
  applyTheme(t);
  try { window.localStorage.setItem(KEY, t); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

/** The saved choice and whether the page is dark right now. "system" / light during server rendering. */
export function useTheme(): { theme: Theme; dark: boolean } {
  const snapshot = useSyncExternalStore(subscribe, () => `${read()}|${prefersDark() ? 1 : 0}`, () => "system|0");
  const [theme, sys] = snapshot.split("|") as [Theme, string];
  return { theme, dark: theme === "dark" || (theme === "system" && sys === "1") };
}
