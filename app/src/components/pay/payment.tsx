"use client";
/**
 * The one payment flow, used everywhere USD₮ moves:
 * Review (recipient, amount in USD₮ and ZAR, network, fee, verified token, balance, warnings)
 * → Approve / Cancel → "Signing with your Tether wallet (WDK)" → Pending until confirmed → Confirmed + Explorer link.
 * Pending P2P payments are remembered on the device and re-checked (never re-sent) after a reload or reconnect.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Check, CircleAlert, Loader2, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import type { HeirloomService } from "@/lib/service";
import type { PaymentReview } from "@/lib/types";
import { formatUsdt, formatZar, shortAddress } from "@/lib/format";
import { useEstate } from "@/lib/hooks/estate";
import { Sheet } from "@/components/ui/client";
import { Badge, Button, ExplorerLink, Notice, TickDisc } from "@/components/ui/primitives";
import { Blocked } from "@/components/shell/blocked";
import { fmt, useCopy } from "@/components/shell/copy";

export interface PayRequest {
  kind: PaymentReview["kind"];
  to: string;
  toLabel: string;
  amount: bigint;
  /** Where the money comes from. Vault payments are made by the estate's contract. */
  source?: "wallet" | "vault";
  /** A review prepared by the service (plain sends). Otherwise one is built from what the app already knows. */
  review?: PaymentReview;
  warnings?: string[];
  /** The on-chain action for non-P2P payments. Must resolve to something carrying the transaction signature. */
  execute?: (svc: HeirloomService, estate: string) => Promise<unknown>;
  successText?: string;
}
export interface PayResult { ok: boolean; code?: string; message?: string; signature?: string }
type Phase = "review" | "signing" | "pending" | "confirmed" | "failed";

interface PayApi { pay(req: PayRequest): Promise<PayResult>; online: boolean; rechecking: number }
const Ctx = createContext<PayApi | null>(null);
export function usePay(): PayApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePay must be used inside <PaymentProvider>");
  return v;
}

const STORE = "heirloom.pendingPayments";
const readPending = (): string[] => { try { return JSON.parse(window.localStorage.getItem(STORE) ?? "[]") as string[]; } catch { return []; } };
const writePending = (ids: string[]) => { try { window.localStorage.setItem(STORE, JSON.stringify(ids)); } catch { /* ignore */ } };

function signatureOf(v: unknown): string | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as { signature?: unknown; tx?: { signature?: unknown } };
  return typeof o.signature === "string" ? o.signature : typeof o.tx?.signature === "string" ? o.tx.signature : undefined;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

export function PaymentProvider({ children }: { children: ReactNode }) {
  const { pay: copy } = useCopy();
  const { service, snap, session, walletUsdt, isMock, run, refresh, notify, explain, fx } = useEstate();
  const online = useOnline();
  const reduced = useReducedMotion();
  const [req, setReq] = useState<PayRequest | null>(null);
  const [review, setReview] = useState<PaymentReview | null>(null);
  const [phase, setPhase] = useState<Phase>("review");
  const [signature, setSignature] = useState<string | undefined>();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const resolver = useRef<((r: PayResult) => void) | null>(null);
  const activeId = useRef<string | null>(null);
  const rate = fx?.usdtZar ?? null;

  // Hydrate from localStorage after mount (not during render, so SSR markup matches).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPendingIds(readPending()); }, []);
  // Also pick up payments the service itself still has open: on load, on reconnect and when the tab returns.
  useEffect(() => {
    if (!service || !session) return;
    const sync = () => {
      if (!navigator.onLine) return;
      service.listPendingReceipts().then((list) => {
        if (list.length) setPendingIds((prev) => { const next = Array.from(new Set([...prev, ...list.map((r) => r.id)])); writePending(next); return next; });
      }).catch(() => undefined);
    };
    const vis = () => { if (document.visibilityState === "visible") sync(); };
    sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", vis); };
  }, [service, session]);
  const track = useCallback((id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = on ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id);
      writePending(next);
      return next;
    });
  }, []);

  // Re-check remembered pending payments: on load, on reconnect, then every few seconds. Never re-sends.
  useEffect(() => {
    if (!service || !online || pendingIds.length === 0) return;
    let alive = true;
    const check = async () => {
      for (const id of pendingIds) {
        try {
          const r = await service.getReceipt(id);
          if (!alive) return;
          if (!r || r.status === "confirmed" || r.status === "failed" || r.status === "cancelled") {
            track(id, false);
            if (id === activeId.current) {
              if (r?.status === "confirmed") setPhase("confirmed");
              else if (r) { setError({ code: "generic", message: r.error ?? copy.failed.body }); setPhase("failed"); }
            } else if (r?.status === "confirmed") notify("ok", copy.recheck.confirmedPlain);
            else if (r) notify("error", copy.recheck.failed);
            void refresh();
          }
        } catch { /* still offline or busy: try again on the next tick */ }
      }
    };
    void check();
    const t = window.setInterval(check, 1500);
    return () => { alive = false; window.clearInterval(t); };
  }, [service, online, pendingIds, track, notify, refresh, copy]);

  const pay = useCallback((r: PayRequest) => new Promise<PayResult>((resolve) => {
    const source = r.source ?? "wallet";
    const available = source === "vault" ? snap?.estate.vaultBalance ?? BigInt(0) : walletUsdt;
    const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "localnet" ? "localnet" : "devnet";
    const built: PaymentReview = r.review ?? {
      id: `local_${Math.random().toString(36).slice(2)}`, kind: r.kind, from: source === "vault" ? snap?.estate.address ?? "" : session?.address ?? "", to: r.to, toLabel: r.toLabel, amount: r.amount,
      token: { symbol: "USD₮", mint: snap?.estate.usdtMint ?? "", verified: true },
      network: { name: `Solana ${cluster}`, cluster },
      fee: { lamports: 5000, sol: 0.000005, payer: session?.address ?? "", sponsored: false },
      balances: { usdt: available, sol: session?.solBalance ?? 0, sufficient: available >= r.amount },
      warnings: r.warnings ?? [], simulated: isMock,
    };
    resolver.current = resolve;
    activeId.current = built.id;
    setReview(built); setReq(r); setPhase("review"); setError(null); setSignature(undefined);
  }), [snap, session, walletUsdt, isMock]);

  const finish = (result: PayResult) => { resolver.current?.(result); resolver.current = null; };
  const close = () => {
    if (phase === "signing") return; // never abandon a signature half way
    if (phase === "review") { finish({ ok: false, code: "cancelled" }); notify("info", copy.cancelled); }
    else finish({ ok: phase !== "failed", signature, ...(error ?? {}) });
    activeId.current = null;
    setReq(null); setReview(null);
  };

  const approve = async () => {
    if (!req || !review || !service || phase !== "review") return; // guards against double-submit
    setPhase("signing");
    if (req.execute) {
      const res = await run(`pay:${review.id}`, req.execute, undefined, true);
      if (!res.ok) { setError({ code: res.code, message: res.message }); setPhase("failed"); return; }
      setSignature(signatureOf(res.value));
      setPhase("pending");
      window.setTimeout(() => { if (activeId.current === review.id) { setPhase("confirmed"); if (req.successText) notify("ok", req.successText); } }, 1600);
      return;
    }
    try {
      const receipt = await service.confirmSend(review);
      setSignature(receipt.signature);
      if (receipt.status === "confirmed") { setPhase("confirmed"); void refresh(); return; }
      if (receipt.status === "failed" || receipt.status === "cancelled") { setError({ code: "generic", message: receipt.error ?? copy.failed.body }); setPhase("failed"); return; }
      track(review.id, true);
      setPhase("pending");
      void refresh();
    } catch (e) {
      // A dropped connection mid-send is ambiguous: keep the id so it is re-checked instead of sent again.
      if (!navigator.onLine) { track(review.id, true); setError({ code: "generic", message: copy.failed.unknown }); setPhase("failed"); return; }
      setError(explain(e));
      setPhase("failed");
    }
  };

  const steps: Phase[] = ["review", "signing", "pending", "confirmed"];
  const at = phase === "failed" ? 1 : steps.indexOf(phase);
  const c = copy.review;
  const fromVault = (req?.source ?? "wallet") === "vault";
  const contractBlock = error && !["generic", "InsufficientFunds", "InvalidAddress", "cancelled"].includes(error.code);

  return (
    <Ctx.Provider value={{ pay, online, rechecking: pendingIds.filter((id) => id !== review?.id).length }}>
      {children}
      <Sheet open={!!req} onClose={close} title={phase === "review" ? c.title : phase === "signing" ? copy.signing.title : phase === "pending" ? copy.pending.title : phase === "confirmed" ? copy.confirmed.title : copy.failed.title} description={phase === "review" ? c.body : undefined} closeLabel={phase === "review" ? c.cancel : copy.failed.close}>
        {req && review && (
          <div className="flex flex-col gap-4">
            <ol aria-label={copy.stepsLabel} className="flex gap-1.5">
              {steps.map((st, i) => (
                <li key={st} aria-current={i === at ? "step" : undefined} className="flex flex-1 flex-col gap-1">
                  <span className={clsx("h-1.5 rounded-full transition-colors duration-300", phase === "confirmed" || i <= at ? "bg-ink" : "bg-line")} />
                  <span className={clsx("text-[0.7rem] font-semibold", i === at ? "text-ink" : "text-ink-2")}>{st === "review" ? copy.steps.review : st === "signing" ? copy.steps.sign : st === "pending" ? copy.steps.pending : copy.steps.confirmed}</span>
                </li>
              ))}
            </ol>

            {/* Amount and recipient stay visible through every phase */}
            <div className={clsx("rounded-lg border p-4 text-center", phase === "confirmed" ? "brand-panel confirm-pop border-ink" : phase === "pending" ? "border-[1.5px] border-dashed border-ink bg-surface" : phase === "failed" ? "border-2 border-ink bg-surface" : "border-line-strong bg-surface")}>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge tone="accent">{c.kinds[review.kind]}</Badge>
                {review.simulated && <Badge tone="warn">{c.simulated}</Badge>}
                {phase === "pending" && <Badge tone="warn"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{copy.pending.badge}</Badge>}
                {phase === "confirmed" && <Badge tone="gold"><TickDisc />{copy.confirmed.badge}</Badge>}
              </div>
              <p className="mt-2 font-display text-h1 tabular-nums">{formatUsdt(review.amount)}</p>
              <p className="min-h-6 text-ink-2 tabular-nums">{rate ? `≈ ${formatZar(review.amount, rate)}` : ""}</p>
              <p className="mt-1 font-semibold">{c.to} {review.toLabel}</p>
              <p className="font-mono text-small text-ink-2">{shortAddress(review.to, 6)}</p>
            </div>

            {phase === "review" && (
              <>
                <dl className="text-small">
                  {[
                    { k: c.from, v: fromVault ? c.viaContract : `${session?.label ?? ""} · ${shortAddress(review.from)}` },
                    { k: c.network, v: review.network.name },
                    { k: c.token, v: <span className={clsx("inline-flex items-center gap-1 font-semibold", review.token.verified ? "text-ink" : "rounded-[3px] bg-ink px-1.5 text-bg")}>{review.token.verified ? <BadgeCheck className="size-4" aria-hidden="true" /> : <ShieldAlert className="size-4" aria-hidden="true" />}{review.token.verified ? c.verified : c.unverified}</span> },
                    { k: c.fee, v: fmt(review.fee.sponsored ? c.feeSponsored : review.fee.payer === session?.address ? c.feeYou : c.feeBy, { sol: review.fee.sol.toFixed(6), payer: shortAddress(review.fee.payer) }) },
                    { k: fromVault ? c.balanceVault : c.balance, v: <>{formatUsdt(review.balances.usdt)}{review.balances.sufficient && <span className="block text-ink-2">{fmt(c.after, { amount: formatUsdt(review.balances.usdt - review.amount) })}</span>}</> },
                  ].map((row) => (
                    <div key={row.k} className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
                      <dt className="shrink-0 text-ink-2">{row.k}</dt>
                      <dd className="min-w-0 text-right font-medium">{row.v}</dd>
                    </div>
                  ))}
                </dl>
                {!review.token.verified && <Notice tone="danger" icon={<ShieldAlert className="size-5" aria-hidden="true" />}><p role="alert">{c.unverifiedWarning}</p></Notice>}
                {review.warnings.length > 0 && (
                  <Notice tone="warn" icon={<CircleAlert className="size-5" aria-hidden="true" />} title={c.warnings}>
                    <ul className="mt-1 list-disc space-y-1 pl-4">{review.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  </Notice>
                )}
                {!review.balances.sufficient && (
                  <Notice tone="danger" icon={<CircleAlert className="size-5" aria-hidden="true" />} title={c.insufficientTitle}>
                    <p role="alert">{fmt(c.insufficientBody, { have: formatUsdt(review.balances.usdt), need: formatUsdt(review.amount) })}</p>
                  </Notice>
                )}
                {!online && <Notice tone="warn" icon={<WifiOff className="size-5" aria-hidden="true" />}><p role="status">{c.offline}</p></Notice>}
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={close}>{review.balances.sufficient ? c.cancel : c.changeAmount}</Button>
                  <Button className="flex-[2] min-h-13!" onClick={approve} disabled={!review.balances.sufficient || !review.token.verified || !online}>{c.approve}</Button>
                </div>
              </>
            )}

            {phase === "signing" && (
              <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-6 text-center">
                <Loader2 className="size-10 animate-spin text-ink" aria-hidden="true" />
                <p className="text-lead font-semibold">{copy.signing.title}</p>
                <p className="max-w-xs text-small text-ink-2">{copy.signing.body}</p>
              </div>
            )}

            {phase === "pending" && (
              <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="relative grid size-14 place-items-center rounded-full border-2 border-dashed border-ink text-ink"><RefreshCw className="size-7 animate-spin [animation-duration:2.2s]" aria-hidden="true" /></span>
                <p className="max-w-sm text-small text-ink-2">{copy.pending.body}</p>
                {signature && <ExplorerLink signature={signature} label={copy.confirmed.receipt} srLabel={copy.confirmed.receiptSr} />}
              </div>
            )}

            {phase === "confirmed" && (
              <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-2 text-center">
                <motion.span initial={reduced ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }} className="relative my-2 grid size-20 place-items-center rounded-full bg-ink text-bg"><span className="confirm-ring absolute inset-0" aria-hidden="true" /><Check className="size-10" strokeWidth={3} aria-hidden="true" /></motion.span>
                <p className="text-small text-ink-2">{copy.confirmed.body}</p>
                {signature && <ExplorerLink signature={signature} label={copy.confirmed.receipt} srLabel={copy.confirmed.receiptSr} />}
                <Button block onClick={close}>{copy.confirmed.done}</Button>
              </div>
            )}

            {phase === "failed" && error && (
              <div className="flex flex-col gap-3">
                {contractBlock
                  ? <Blocked code={error.code} message={error.message} />
                  : <Notice tone="danger" icon={<CircleAlert className="size-5" aria-hidden="true" />} title={error.message}><p role="alert">{pendingIds.includes(review.id) ? "" : copy.failed.body}</p></Notice>}
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={close}>{copy.failed.close}</Button>
                  {!contractBlock && !pendingIds.includes(review.id) && <Button className="flex-1" onClick={() => { setError(null); setPhase("review"); }}>{copy.failed.retry}</Button>}
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </Ctx.Provider>
  );
}

/** Thin bars under the header: offline, and "re-checking" for payments still pending from earlier. */
export function ConnectionBars() {
  const { pay: copy } = useCopy();
  const { online, rechecking } = usePay();
  if (online && rechecking === 0) return null;
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <p className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-small font-medium text-bg"><WifiOff className="size-4 shrink-0" aria-hidden="true" />{copy.offline.banner}</p>
      )}
      {online && rechecking > 0 && (
        <p className="flex items-center justify-center gap-2 border-b border-dashed border-ink bg-surface px-4 py-2 text-center text-small font-semibold text-ink"><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />{rechecking === 1 ? copy.recheck.banner : fmt(copy.recheck.bannerMany, { n: rechecking })}</p>
      )}
    </div>
  );
}
