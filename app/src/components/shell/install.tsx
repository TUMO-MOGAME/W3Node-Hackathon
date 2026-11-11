"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, X } from "@/components/ui/icons";
import { Button } from "@/components/ui/primitives";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "unsupported" | "ready" | "ios" | "installed";
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** Install-to-home-screen state. Chrome/Edge/Android offer a prompt; iOS Safari needs manual steps. */
export function useInstall() {
  const [state, setState] = useState<InstallState>("unsupported");
  useEffect(() => {
    const compute = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      setState(standalone ? "installed" : deferred ? "ready" : ios ? "ios" : "unsupported");
    };
    compute();
    listeners.add(compute);
    return () => { listeners.delete(compute); };
  }, []);
  const prompt = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") deferred = null;
    listeners.forEach((l) => l());
  }, []);
  return { state, prompt };
}

/** A gentle, dismissible invitation to install. Shown once per device until dismissed. */
export function InstallBanner({ copy }: { copy: { title: string; body: string; cta: string; ios: string; dismiss: string } }) {
  const { state, prompt } = useInstall();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    // Read localStorage after mount so the server-rendered markup matches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setHidden(window.localStorage.getItem("heirloom.install.dismissed") === "1"); } catch { setHidden(false); }
  }, []);
  if (hidden || (state !== "ready" && state !== "ios")) return null;
  const dismiss = () => {
    setHidden(true);
    try { window.localStorage.setItem("heirloom.install.dismissed", "1"); } catch { /* ignore */ }
  };
  return (
    <aside aria-label={copy.title} className="flex items-start gap-3 rounded-lg border border-ink bg-surface p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-bg"><Download className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{copy.title}</p>
        <p className="text-small text-ink-2">{state === "ios" ? copy.ios : copy.body}</p>
        {state === "ready" && <Button small className="mt-2.5" onClick={() => void prompt()}>{copy.cta}</Button>}
      </div>
      <button type="button" onClick={dismiss} aria-label={copy.dismiss} className="-mr-1.5 -mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
        <X className="size-5" aria-hidden="true" />
      </button>
    </aside>
  );
}
