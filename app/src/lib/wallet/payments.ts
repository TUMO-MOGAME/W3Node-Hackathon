/**
 * Pay-once payment pipeline (Tether track flow): review → approve → WDK signs → we persist the signature →
 * broadcast → receipt "pending" until confirmed.
 *
 * Why we sign first and broadcast ourselves: a Solana signature is known as soon as the tx is signed. We store
 * it (plus the signed bytes and the blockhash expiry) in localStorage BEFORE broadcasting, so after a dropped
 * connection or a reload we re-check that same signature and, if needed, re-broadcast the same signed bytes.
 * Re-broadcasting identical bytes can never pay twice; once the blockhash expires the tx can never land, so
 * only then do we declare it "not paid, safe to retry". A payment id with a signature is never re-signed.
 * Pure logic with injectable storage/chain ops, so it is unit-tested (payments.test.ts).
 */
import type { PaymentReceipt, PaymentReview, PaymentStatus } from "../types";
import { explorerTx } from "../format";

export interface StoredPayment extends PaymentReceipt {
  kind?: PaymentReview["kind"];
  to?: string;
  toLabel?: string;
  amount?: string; // base units as string (JSON-safe)
  wireBase64?: string;
  lastValidBlockHeight?: number;
}

export interface ReceiptStore {
  get(id: string): StoredPayment | null;
  put(p: StoredPayment): void;
  list(): StoredPayment[];
}

export interface SignedTx { signature: string; wireBase64: string; lastValidBlockHeight: number }

export interface ChainOps {
  /** null = the cluster does not know this signature (yet). */
  status(signature: string): Promise<{ err: unknown; confirmationStatus?: string | null; confirmations?: number | null } | null>;
  blockHeight(): Promise<number>;
  broadcast(wireBase64: string): Promise<void>;
}

const OPEN: PaymentStatus[] = ["signing", "submitted", "pending"];

export function newPaymentId(): string {
  return `pay_${Date.now().toString(36)}_${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// ---------- stores ----------
const KEY = "heirloom.payments.v1";

export function localReceiptStore(): ReceiptStore {
  const read = (): Record<string, StoredPayment> => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, StoredPayment>; } catch { return {}; }
  };
  const write = (all: Record<string, StoredPayment>) => {
    // keep the newest 100 receipts
    const entries = Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 100);
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries.map((e) => [e.id, e])))); } catch { /* storage unavailable */ }
  };
  return {
    get: (id) => read()[id] ?? null,
    put: (p) => { const all = read(); all[p.id] = p; write(all); },
    list: () => Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt),
  };
}

export function memoryReceiptStore(): ReceiptStore {
  const m = new Map<string, StoredPayment>();
  return { get: (id) => m.get(id) ?? null, put: (p) => { m.set(p.id, { ...p }); }, list: () => [...m.values()] };
}

/** Browser default: localStorage when available, else memory (private mode). */
export function defaultReceiptStore(): ReceiptStore {
  try { localStorage.getItem(KEY); return localReceiptStore(); } catch { return memoryReceiptStore(); }
}

// ---------- pipeline ----------
const publicReceipt = (p: StoredPayment): PaymentReceipt => ({
  id: p.id, status: p.status, signature: p.signature, explorerUrl: p.explorerUrl, confirmations: p.confirmations, error: p.error, updatedAt: p.updatedAt,
});

function save(store: ReceiptStore, p: StoredPayment, patch: Partial<StoredPayment>): StoredPayment {
  const next = { ...p, ...patch, updatedAt: Date.now() };
  store.put(next);
  return next;
}

/** True when an RPC error means the tx was rejected before it could ever land (preflight/simulation). */
export function isDefinitiveRejection(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /simulation failed|preflight|custom program error|insufficient|Error Code:|InstructionError|0x1\b/i.test(msg);
}

/**
 * Re-checks a stored payment. Never signs. May re-broadcast the SAME signed bytes while the blockhash is valid.
 */
export async function recheck(store: ReceiptStore, ops: ChainOps, id: string): Promise<PaymentReceipt | null> {
  const p = store.get(id);
  if (!p) return null;
  if (!p.signature || !OPEN.includes(p.status)) {
    // "signing" without a signature = the app closed before WDK produced one: nothing was broadcast.
    if (p.status === "signing" && !p.signature) {
      return publicReceipt(save(store, p, { status: "failed", error: "Signing was interrupted before anything was sent. Nothing was paid; you can try again." }));
    }
    return publicReceipt(p);
  }
  const st = await ops.status(p.signature);
  if (st?.err) {
    return publicReceipt(save(store, p, { status: "failed", error: `The network rejected this payment (${JSON.stringify(st.err)}). Nothing was paid.` }));
  }
  if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) {
    return publicReceipt(save(store, p, { status: "confirmed", confirmations: st.confirmations ?? undefined, error: undefined }));
  }
  if (st) return publicReceipt(save(store, p, { status: "pending", confirmations: st.confirmations ?? 0 }));

  // Unknown to the cluster: still landable while the blockhash is valid → re-broadcast the same bytes.
  const height = await ops.blockHeight();
  if (p.lastValidBlockHeight !== undefined && height > p.lastValidBlockHeight) {
    return publicReceipt(save(store, p, { status: "failed", error: "This payment expired before it reached the network. Nothing was paid; it is safe to try again." }));
  }
  if (p.wireBase64) await ops.broadcast(p.wireBase64).catch(() => undefined);
  return publicReceipt(save(store, p, { status: "pending" }));
}

/**
 * Runs a payment once. If this id already has a signature, it only re-checks (never re-signs, never pays twice).
 */
export async function runPayment(
  store: ReceiptStore, ops: ChainOps, id: string, sign: () => Promise<SignedTx>,
  meta: Pick<StoredPayment, "kind" | "to" | "toLabel" | "amount"> = {},
): Promise<PaymentReceipt> {
  const existing = store.get(id);
  if (existing?.signature) return (await recheck(store, ops, id))!;
  if (existing && (existing.status === "confirmed" || existing.status === "cancelled")) return publicReceipt(existing);

  let p = save(store, existing ?? { id, status: "signing", updatedAt: Date.now() }, { ...meta, status: "signing", error: undefined });
  let signed: SignedTx;
  try {
    signed = await sign();
  } catch (e) {
    return publicReceipt(save(store, p, { status: "failed", error: `Not signed: ${e instanceof Error ? e.message : String(e)}. Nothing was paid.` }));
  }
  // Persist BEFORE broadcasting: from here on, this id is bound to this signature.
  p = save(store, p, {
    status: "submitted", signature: signed.signature, explorerUrl: explorerTx(signed.signature),
    wireBase64: signed.wireBase64, lastValidBlockHeight: signed.lastValidBlockHeight,
  });
  try {
    await ops.broadcast(signed.wireBase64);
  } catch (e) {
    if (isDefinitiveRejection(e)) {
      return publicReceipt(save(store, p, { status: "failed", error: `${e instanceof Error ? e.message : String(e)}. Nothing was paid.` }));
    }
    // Network trouble: keep "submitted"; recheck() on reconnect decides.
    return publicReceipt(save(store, p, { error: "Connection problem while sending. We will re-check this payment automatically; do not pay again." }));
  }
  return (await recheck(store, ops, id))!;
}

export function cancelPayment(store: ReceiptStore, id: string): PaymentReceipt | null {
  const p = store.get(id);
  if (!p) { const c: StoredPayment = { id, status: "cancelled", updatedAt: Date.now() }; store.put(c); return publicReceipt(c); }
  if (p.signature) return publicReceipt(p); // too late to cancel: it may already be on its way
  return publicReceipt(save(store, p, { status: "cancelled" }));
}

/** Polls until confirmed/failed or timeout; returns the last receipt. */
export async function waitForFinal(store: ReceiptStore, ops: ChainOps, id: string, timeoutMs = 60_000, everyMs = 1_000): Promise<PaymentReceipt | null> {
  const end = Date.now() + timeoutMs;
  let r = await recheck(store, ops, id);
  while (r && OPEN.includes(r.status) && Date.now() < end) {
    await new Promise((res) => setTimeout(res, everyMs));
    r = await recheck(store, ops, id);
  }
  return r;
}

export function openReceipts(store: ReceiptStore): PaymentReceipt[] {
  return store.list().filter((p) => OPEN.includes(p.status)).map(publicReceipt);
}

/** Re-checks every open payment now and whenever the browser comes back online or the tab becomes visible. */
export function resumeOnReconnect(store: ReceiptStore, ops: ChainOps, onUpdate?: (r: PaymentReceipt) => void): () => void {
  const run = async () => {
    for (const r of openReceipts(store)) {
      const next = await recheck(store, ops, r.id).catch(() => null);
      if (next) onUpdate?.(next);
    }
  };
  void run();
  if (typeof window === "undefined") return () => undefined;
  const vis = () => { if (document.visibilityState === "visible") void run(); };
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", vis);
  return () => { window.removeEventListener("online", run); document.removeEventListener("visibilitychange", vis); };
}
