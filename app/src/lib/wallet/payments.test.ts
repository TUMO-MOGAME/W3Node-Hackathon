import { describe, expect, it, vi } from "vitest";
import { cancelPayment, memoryReceiptStore, openReceipts, recheck, runPayment, type ChainOps, type SignedTx } from "./payments";

type St = Awaited<ReturnType<ChainOps["status"]>>;

function fakeChain(init: { status?: St; height?: number; broadcastError?: Error } = {}) {
  const state = { status: init.status ?? null, height: init.height ?? 100, broadcasts: 0, broadcastError: init.broadcastError };
  const ops: ChainOps = {
    status: async () => state.status,
    blockHeight: async () => state.height,
    broadcast: async () => { state.broadcasts++; if (state.broadcastError) throw state.broadcastError; },
  };
  return { ops, state };
}

const signed: SignedTx = { signature: "SIG1", wireBase64: "AAAA", lastValidBlockHeight: 150 };

describe("pay-once pipeline", () => {
  it("persists the signature before broadcasting, then reports pending → confirmed", async () => {
    const store = memoryReceiptStore();
    const { ops, state } = fakeChain();
    const order: string[] = [];
    const sign = vi.fn(async () => { order.push("sign"); return signed; });
    ops.broadcast = async () => { order.push(`broadcast:${store.get("p1")?.signature}`); state.broadcasts++; };
    const r = await runPayment(store, ops, "p1", sign, { kind: "p2p", amount: "1000000" });
    expect(order[0]).toBe("sign");
    expect(order[1]).toBe("broadcast:SIG1"); // already stored when broadcast happened
    expect(r.status).toBe("pending");
    state.status = { err: null, confirmationStatus: "confirmed", confirmations: 1 };
    expect((await recheck(store, ops, "p1"))?.status).toBe("confirmed");
  });

  it("never re-signs an id that already has a signature (no double pay on retry)", async () => {
    const store = memoryReceiptStore();
    const { ops } = fakeChain();
    const sign = vi.fn(async () => signed);
    await runPayment(store, ops, "p2", sign);
    await runPayment(store, ops, "p2", sign);
    await runPayment(store, ops, "p2", sign);
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it("network error while sending keeps it submitted; reconnect re-broadcasts the same bytes", async () => {
    const store = memoryReceiptStore();
    const { ops, state } = fakeChain({ broadcastError: new Error("fetch failed") });
    const r = await runPayment(store, ops, "p3", async () => signed);
    expect(r.status).toBe("submitted");
    expect(r.error).toMatch(/do not pay again/);
    state.broadcastError = undefined;
    const before = state.broadcasts;
    expect(openReceipts(store).map((x) => x.id)).toEqual(["p3"]);
    expect((await recheck(store, ops, "p3"))?.status).toBe("pending");
    expect(state.broadcasts).toBe(before + 1);
  });

  it("declares 'not paid, safe to retry' only after the blockhash expired", async () => {
    const store = memoryReceiptStore();
    const { ops, state } = fakeChain({ broadcastError: new Error("offline") });
    await runPayment(store, ops, "p4", async () => signed);
    state.height = 150; // still valid
    expect((await recheck(store, ops, "p4"))?.status).toBe("pending");
    state.height = 151; // expired and unseen → can never land
    const r = await recheck(store, ops, "p4");
    expect(r?.status).toBe("failed");
    expect(r?.error).toMatch(/safe to try again/);
  });

  it("a preflight rejection fails immediately (nothing paid)", async () => {
    const store = memoryReceiptStore();
    const { ops } = fakeChain({ broadcastError: new Error("Transaction simulation failed: Error Code: ExceedsPerClaimCap") });
    expect((await runPayment(store, ops, "p5", async () => signed)).status).toBe("failed");
  });

  it("on-chain error → failed; signing error → failed with nothing sent", async () => {
    const store = memoryReceiptStore();
    const { ops, state } = fakeChain({ status: { err: { InstructionError: [0, "x"] } } });
    expect((await runPayment(store, ops, "p6", async () => signed)).status).toBe("failed");
    const r = await runPayment(store, ops, "p7", async () => { throw new Error("Wrong PIN."); });
    expect(r.status).toBe("failed");
    expect(state.broadcasts).toBe(1);
  });

  it("an interrupted signing (reload mid-sign) resolves to failed/not paid", async () => {
    const store = memoryReceiptStore();
    store.put({ id: "p8", status: "signing", updatedAt: 1 });
    const { ops } = fakeChain();
    expect((await recheck(store, ops, "p8"))?.status).toBe("failed");
  });

  it("cancel works before signing, not after", async () => {
    const store = memoryReceiptStore();
    expect(cancelPayment(store, "c1")?.status).toBe("cancelled");
    const { ops } = fakeChain();
    const sign = vi.fn(async () => signed);
    expect((await runPayment(store, ops, "c1", sign)).status).toBe("cancelled");
    expect(sign).not.toHaveBeenCalled();
    await runPayment(store, ops, "c2", async () => signed);
    expect(cancelPayment(store, "c2")?.status).toBe("pending");
  });
});
