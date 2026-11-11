"use client";
/**
 * App-wide client state: the active service, the estate snapshot for whoever is acting, the ZAR rate,
 * a `run()` helper for writes (busy state, friendly errors, refresh, toast), and small UI intents that
 * let the agent open things for the user (a prefilled claim, a rule, an upload).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getService, type EstateSnapshot, type HeirloomService } from "../service";
import { isMockService, type DemoStage } from "../service/mock";
import type { FxRate, Role, WalletSession } from "../types";
import { useWallet } from "./wallet-source";

export type RunResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };
export type Intent =
  | { kind: "claim"; rule?: string; payee?: string; amount?: number }
  | { kind: "rule"; rule: string }
  | { kind: "upload"; purpose: "death" | "claim" | "hardship" };
export interface Toast { id: number; tone: "ok" | "error" | "info"; text: string }
export type AgentMode = "chat" | "call";
export type DemoShortcut = "simulatePassing" | "skipWait" | "makeDue";

interface EstateCtx {
  service: HeirloomService | null;
  isMock: boolean;
  phase: "loading" | "empty" | "ready" | "error";
  snap: EstateSnapshot | null;
  fx: FxRate | null;
  loadError: string | null;
  session: WalletSession | null;
  role: Role | null;
  /** Spendable USD₮ of the acting wallet (base units). */
  walletUsdt: bigint;
  busy: string | null;
  refresh(): Promise<void>;
  /** Runs a write. `silent` skips the error toast for callers that show the refusal in place. */
  run<T>(key: string, fn: (svc: HeirloomService, estate: string) => Promise<T>, success?: string, silent?: boolean): Promise<RunResult<T>>;
  explain(error: unknown): { code: string; message: string };
  toasts: Toast[];
  notify(tone: Toast["tone"], text: string): void;
  dismiss(id: number): void;
  intent: Intent | null;
  setIntent(i: Intent | null): void;
  agent: AgentMode | null;
  openAgent(mode: AgentMode): void;
  closeAgent(): void;
  proofOpen: boolean;
  setProofOpen(open: boolean): void;
  resetDemo(stage: DemoStage): Promise<void>;
  /** Mock-only shortcuts for a quick demo. Returns false if the shortcut does not apply right now. */
  demoShortcut(kind: DemoShortcut): Promise<boolean>;
}

const Ctx = createContext<EstateCtx | null>(null);
const LAST_ESTATE = "heirloom.lastEstate";

export function EstateProvider({ children, errors }: { children: ReactNode; errors: Record<string, string> }) {
  const wallet = useWallet();
  const session = wallet.session;
  const [service, setService] = useState<HeirloomService | null>(null);
  const [phase, setPhase] = useState<EstateCtx["phase"]>("loading");
  const [snap, setSnap] = useState<EstateSnapshot | null>(null);
  const [fx, setFx] = useState<FxRate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [agent, setAgent] = useState<AgentMode | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [walletUsdt, setWalletUsdt] = useState<bigint>(BigInt(0));
  const estateRef = useRef<string | null>(null);
  const toastId = useRef(0);
  const loadSeq = useRef(0);

  const explain = useCallback((error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error);
    const code = Object.keys(errors).find((k) => k !== "generic" && new RegExp(`\\b${k}\\b`).test(raw)) ?? "generic";
    return { code, message: errors[code] ?? errors.generic ?? raw };
  }, [errors]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback((tone: Toast["tone"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500);
  }, [dismiss]);

  useEffect(() => {
    let alive = true;
    getService().then((s) => { if (alive) setService(s); }).catch((e) => {
      if (!alive) return;
      setLoadError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    });
    return () => { alive = false; };
  }, []);

  const address = session?.address ?? null;
  const sessionRole = session?.role ?? null;
  const sessionLabel = session?.label ?? null;
  const sessionUsdt = session?.usdtBalance ?? BigInt(0);

  const load = useCallback(async (quiet: boolean) => {
    if (!service) return;
    const seq = ++loadSeq.current;
    if (!quiet) setPhase((p) => (p === "ready" ? p : "loading"));
    try {
      if (isMockService(service)) {
        service.setActor(address && sessionRole && sessionLabel ? { address, role: sessionRole, label: sessionLabel } : null);
      }
      const [list, rate] = await Promise.all([
        address ? service.listEstatesFor(address) : Promise.resolve([]),
        service.getFx().catch(() => null),
      ]);
      let estate: string | null = list[0]?.estate ?? null;
      if (!estate && !isMockService(service)) {
        try { estate = window.localStorage.getItem(LAST_ESTATE); } catch { /* ignore */ }
      }
      if (seq !== loadSeq.current) return;
      if (rate) setFx(rate);
      setWalletUsdt(isMockService(service) && address ? service.balanceOf(address) ?? sessionUsdt : sessionUsdt);
      if (!estate) {
        estateRef.current = null;
        setSnap(null);
        setPhase("empty");
        return;
      }
      const next = await service.getEstate(estate);
      if (seq !== loadSeq.current) return;
      estateRef.current = estate;
      try { window.localStorage.setItem(LAST_ESTATE, estate); } catch { /* ignore */ }
      setSnap(next);
      setLoadError(null);
      setPhase("ready");
    } catch (e) {
      if (seq !== loadSeq.current) return;
      if (quiet && estateRef.current) return; // keep showing the last good data during a blip
      setLoadError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [service, address, sessionRole, sessionLabel, sessionUsdt]);

  useEffect(() => { void load(false); }, [load]);

  useEffect(() => {
    if (!service) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [service, load]);

  const refresh = useCallback(async () => {
    await load(true);
    void wallet.refreshBalances().catch(() => undefined);
  }, [load, wallet]);

  const run = useCallback(async <T,>(key: string, fn: (svc: HeirloomService, estate: string) => Promise<T>, success?: string, silent = false): Promise<RunResult<T>> => {
    if (!service) return { ok: false, code: "generic", message: errors.generic };
    setBusy(key);
    try {
      const value = await fn(service, estateRef.current ?? "");
      await load(true);
      void wallet.refreshBalances().catch(() => undefined);
      if (success) notify("ok", success);
      return { ok: true, value };
    } catch (e) {
      const { code, message } = explain(e);
      if (!silent) notify("error", message);
      await load(true);
      return { ok: false, code, message };
    } finally {
      setBusy(null);
    }
  }, [service, errors, load, wallet, notify, explain]);

  const resetDemo = useCallback(async (stage: DemoStage) => {
    if (!isMockService(service)) return;
    service.resetDemo(stage);
    await load(false);
  }, [service, load]);

  const demoShortcut = useCallback(async (kind: DemoShortcut) => {
    if (!isMockService(service)) return false;
    try {
      service[kind]();
      await load(true);
      return true;
    } catch (e) {
      notify("error", explain(e).message);
      return false;
    }
  }, [service, load, notify, explain]);

  const value = useMemo<EstateCtx>(() => ({
    service, isMock: isMockService(service), phase, snap, fx, loadError, session, role: session?.role ?? null, walletUsdt, busy,
    refresh, run, explain, toasts, notify, dismiss, intent, setIntent,
    agent, openAgent: setAgent, closeAgent: () => setAgent(null), proofOpen, setProofOpen, resetDemo, demoShortcut,
  }), [demoShortcut, service, phase, snap, fx, loadError, session, walletUsdt, busy, refresh, run, explain, toasts, notify, dismiss, intent, agent, proofOpen, resetDemo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEstate(): EstateCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEstate must be used inside <EstateProvider>");
  return v;
}
