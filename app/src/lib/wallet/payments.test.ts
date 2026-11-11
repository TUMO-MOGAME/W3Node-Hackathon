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

describe("fee sponsorship (signSponsoredOrSelf / feeForReview)", () => {
  const deps = (over: Partial<import("./payments").SponsoredSignDeps> = {}) => {
    const built: string[] = [];
    const d: import("./payments").SponsoredSignDeps = {
      user: "USER",
      build: async (fp) => { built.push(fp); return { base64: `tx-${fp}`, lastValidBlockHeight: 99 }; },
      signPartial: async (b) => ({ wireBase64: `partial(${b})` }),
      signOnly: async (b) => ({ signature: "USERSIG", wireBase64: `signed(${b})` }),
      sponsor: {
        status: async () => ({ available: true, feePayer: "SPONSOR", maxFeeLamports: 20_000, paysRent: true }),
        cosign: async (w) => ({ signature: "SPONSORSIG", wireBase64: `cosigned(${w})` }),
      },
      ...over,
    };
    return { d, built };
  };

  it("uses the sponsor as fee payer when available", async () => {
    const { signSponsoredOrSelf } = await import("./payments");
    const { d, built } = deps();
    const r = await signSponsoredOrSelf(d);
    expect(built).toEqual(["SPONSOR"]);
    expect(r).toMatchObject({ signature: "SPONSORSIG", wireBase64: "cosigned(partial(tx-SPONSOR))", sponsored: true, feePayer: "SPONSOR", lastValidBlockHeight: 99 });
  });

  it("falls back to the user paying when the sponsor refuses or is down", async () => {
    const { signSponsoredOrSelf, SponsorError } = await import("./payments");
    const { d, built } = deps({ sponsor: { status: async () => ({ available: true, feePayer: "SPONSOR", maxFeeLamports: 1, paysRent: false }), cosign: async () => { throw new SponsorError("rate_limited", "slow down"); } } });
    const onFallback = vi.fn();
    const r = await signSponsoredOrSelf({ ...d, onFallback });
    expect(built).toEqual(["SPONSOR", "USER"]);
    expect(r).toMatchObject({ signature: "USERSIG", sponsored: false, feePayer: "USER" });
    expect(onFallback).toHaveBeenCalledWith("slow down");
    const off = deps({ sponsor: { status: async () => null, cosign: async () => { throw new Error("unreachable"); } } });
    expect((await signSponsoredOrSelf(off.d)).sponsored).toBe(false);
    expect(off.built).toEqual(["USER"]);
  });

  it("does not retry as user-paid when the program would reject the tx anyway", async () => {
    const { signSponsoredOrSelf, SponsorError } = await import("./payments");
    const { d } = deps({ sponsor: { status: async () => ({ available: true, feePayer: "SPONSOR", maxFeeLamports: 1, paysRent: false }), cosign: async () => { throw new SponsorError("simulation_failed", "Rejected by the Heirloom program"); } } });
    await expect(signSponsoredOrSelf(d)).rejects.toThrow(/Heirloom program/);
  });

  it("works with runPayment: the sponsored signature is stored before broadcast", async () => {
    const { signSponsoredOrSelf } = await import("./payments");
    const store = memoryReceiptStore();
    const { ops } = fakeChain();
    const { d } = deps();
    await runPayment(store, ops, "sp1", () => signSponsoredOrSelf(d), { kind: "p2p" });
    expect(store.get("sp1")).toMatchObject({ signature: "SPONSORSIG", sponsored: true, feePayer: "SPONSOR" });
  });

  it("review fee: sponsored → sponsor pays fee and rent; otherwise the user does", async () => {
    const { feeForReview } = await import("./payments");
    const s = { available: true, feePayer: "SPONSOR", maxFeeLamports: 20_000, paysRent: true };
    expect(feeForReview({ user: "U", networkFeeLamports: 10_000, rentLamports: 2_039_280, sponsor: s })).toEqual({ fee: { lamports: 2_049_280, sol: 0.00204928, payer: "SPONSOR", sponsored: true }, userLamports: 0 });
    expect(feeForReview({ user: "U", networkFeeLamports: 10_000, rentLamports: 2_039_280, sponsor: { ...s, paysRent: false } }).userLamports).toBe(2_039_280);
    expect(feeForReview({ user: "U", networkFeeLamports: 5_000, rentLamports: 0, sponsor: null }).fee).toEqual({ lamports: 5_000, sol: 0.000005, payer: "U", sponsored: false });
  });
});
