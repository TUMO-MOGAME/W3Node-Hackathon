"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, Download, Plus, RotateCcw } from "lucide-react";
import type { Role } from "@/lib/types";
import { isMockService, type DemoStage } from "@/lib/service/mock";
import type { DemoShortcut } from "@/lib/hooks/estate";
import { formatUsdt, shortAddress } from "@/lib/format";
import { useWallet } from "@/lib/hooks/wallet-source";
import { useEstate } from "@/lib/hooks/estate";
import { Sheet } from "@/components/ui/client";
import { Button } from "@/components/ui/primitives";
import { Avatar } from "./app-shell";
import { fmt, useCopy } from "./copy";
import { useInstall } from "./install";

const ORDER: Role[] = ["owner", "beneficiary", "verifier", "buyer", "agent"];
const STAGES: DemoStage[] = ["fresh", "funded", "unlocked", "listed", "lowOffers"];
const SHORTCUTS: DemoShortcut[] = ["simulatePassing", "skipWait", "makeDue"];
type Theme = "system" | "light" | "dark";

/** The persona switcher: pick who you are acting as, plus demo controls and appearance. */
export function PersonaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { common } = useCopy();
  const c = common.persona;
  const wallet = useWallet();
  const { isMock, resetDemo, demoShortcut, notify, session, snap, service } = useEstate();
  const mock = isMockService(service) ? service : null;
  const install = useInstall();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const t = window.localStorage.getItem("heirloom.theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch { /* ignore */ }
  }, []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { window.localStorage.setItem("heirloom.theme", t); } catch { /* ignore */ }
  };

  const pick = (address: string, name: string) => {
    wallet.switchTo(address);
    notify("info", fmt(c.switched, { name }));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={c.sheetTitle} description={c.sheetBody} closeLabel={c.close}>
      <div className="flex flex-col gap-5">
        {ORDER.map((role) => {
          const list = wallet.sessions.filter((s) => s.role === role);
          if (!list.length) return null;
          return (
            <section key={role} aria-label={c.groups[role]}>
              <h3 className="mb-2 font-sans text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{c.groups[role]}</h3>
              <ul className="flex flex-col gap-2">
                {list.map((s) => {
                  const active = s.address === session?.address;
                  return (
                    <li key={s.address}>
                      <button
                        type="button" onClick={() => pick(s.address, s.label)} aria-pressed={active}
                        className={clsx("flex min-h-14 w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors", active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}
                      >
                        <Avatar name={s.label} role={s.role} className="size-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{s.label}</span>
                          <span className="block truncate text-small text-ink-2">
                            <span className="font-mono">{shortAddress(s.address)}</span>
                            {(mock?.balanceOf(s.address) ?? s.usdtBalance) > BigInt(0) && <> · {formatUsdt(mock?.balanceOf(s.address) ?? s.usdtBalance, { decimals: 0 })}</>}
                          </span>
                        </span>
                        {active && <span className="inline-flex shrink-0 items-center gap-1 text-small font-semibold text-accent"><Check className="size-4" aria-hidden="true" />{c.current}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <Link href="/start?new=1" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 self-start rounded-full px-1 text-small font-semibold text-accent underline-offset-4 hover:underline">
          <Plus className="size-4" aria-hidden="true" />{c.addWallet}
        </Link>

        {isMock && (
          <section aria-label={common.demo.controlsTitle} className="rounded-lg border border-brass/35 bg-brass-soft/60 p-3.5">
            <h3 className="flex items-center gap-2 font-sans text-body font-semibold tracking-normal"><RotateCcw className="size-4 text-brass" aria-hidden="true" />{common.demo.controlsTitle}</h3>
            <p className="mt-1 text-small text-ink-2">{common.demo.controlsBody} {common.demo.clock}</p>
            {snap && (
              <>
                <h4 className="mt-3 text-small font-semibold">{common.demo.shortcutsTitle}</h4>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {SHORTCUTS.filter((k) => (k === "simulatePassing" ? snap.estate.status === "Active" : k === "skipWait" ? snap.estate.status === "DeathPending" : snap.rules.some((r) => r.recurringAmount > BigInt(0) && r.nextDue !== null))).map((k) => (
                    <button
                      key={k} type="button"
                      onClick={async () => { if (await demoShortcut(k)) { notify("info", common.demo.shortcutDone); onClose(); } }}
                      className="min-h-11 rounded-full bg-ember px-3.5 text-small font-semibold text-ember-ink"
                    >
                      {common.demo.shortcuts[k]}
                    </button>
                  ))}
                </div>
              </>
            )}
            <h4 className="mt-3 text-small font-semibold">{common.demo.guideLabel}</h4>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {STAGES.map((st) => (
                <button
                  key={st} type="button"
                  onClick={async () => { await resetDemo(st); notify("info", common.demo.reset); onClose(); }}
                  className="min-h-11 rounded-full border border-brass/50 bg-surface px-3.5 text-small font-medium hover:bg-surface-2"
                >
                  {common.demo.stages[st]}
                </button>
              ))}
            </div>
          </section>
        )}

        <fieldset>
          <legend className="mb-2 text-small font-semibold uppercase tracking-[0.12em] text-ink-2">{c.theme}</legend>
          <div className="flex rounded-full bg-surface-2 p-1">
            {(["system", "light", "dark"] as const).map((t) => (
              <label key={t} className={clsx("flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-full text-small font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]", theme === t ? "bg-surface shadow-card" : "text-ink-2")}>
                <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => applyTheme(t)} className="sr-only" />
                {t === "system" ? c.themeSystem : t === "light" ? c.themeLight : c.themeDark}
              </label>
            ))}
          </div>
        </fieldset>

        {install.state !== "installed" && install.state !== "unsupported" && (
          <section className="rounded-lg border border-line bg-surface-2/50 p-3.5">
            <h3 className="font-sans text-body font-semibold tracking-normal">{common.install.title}</h3>
            <p className="mt-1 text-small text-ink-2">{install.state === "ios" ? common.install.ios : common.install.body}</p>
            {install.state === "ready" && (
              <Button small className="mt-3" onClick={() => void install.prompt()}><Download className="size-4" aria-hidden="true" />{common.install.cta}</Button>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}
