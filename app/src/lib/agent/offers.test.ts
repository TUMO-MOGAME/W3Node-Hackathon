import { describe, expect, it } from "vitest";
import { rankOffers, minimumAccepted, type RankAsset, type RankOffer } from "./offers";
import { toBase } from "../format";

const asset = (over: Partial<RankAsset> = {}): RankAsset => ({
  floorPrice: toBase(9000), hardshipFloor: toBase(7000), hardshipBeneficiary: null, status: "Listed", ...over,
});
const offer = (address: string, usdt: number, createdAt = 0): RankOffer => ({ address, buyer: `B${address}`, amount: toBase(usdt), createdAt });

describe("rankOffers (mirrors accept_offer)", () => {
  it("uses the floor price when no hardship is approved", () => {
    expect(minimumAccepted(asset())).toEqual({ min: toBase(9000), rule: "floor" });
    const r = rankOffers(asset(), [offer("a", 8999), offer("b", 9000), offer("c", 9500)]);
    expect(r.bestOffer).toBe("c");
    expect(r.eligible.map((e) => e.offer)).toEqual(["c", "b"]);
    expect(r.ineligible.map((e) => e.offer)).toEqual(["a"]);
    expect(r.ineligible[0].reason).toMatch(/Below the floor price/);
  });

  it("accepts exactly the floor (≥, not >)", () => {
    expect(rankOffers(asset(), [offer("x", 9000)]).bestOffer).toBe("x");
  });

  it("uses the hardship floor once hardship is approved, never lower", () => {
    const a = asset({ hardshipBeneficiary: "Child" });
    expect(minimumAccepted(a).rule).toBe("hardship_floor");
    const r = rankOffers(a, [offer("low", 6999.99), offer("ok", 7000), offer("mid", 8000)]);
    expect(r.bestOffer).toBe("mid");
    expect(r.eligible.map((e) => e.offer)).toEqual(["mid", "ok"]);
    expect(r.ineligible[0].reason).toMatch(/hardship floor/);
  });

  it("returns no best offer when nothing qualifies", () => {
    expect(rankOffers(asset(), [offer("a", 100)]).bestOffer).toBeNull();
    expect(rankOffers(asset(), []).bestOffer).toBeNull();
  });

  it("breaks ties by earliest offer", () => {
    expect(rankOffers(asset(), [offer("late", 9500, 20), offer("early", 9500, 10)]).bestOffer).toBe("early");
  });

  it("nothing is eligible unless the car is listed", () => {
    const r = rankOffers(asset({ status: "Held" }), [offer("a", 20000)]);
    expect(r.bestOffer).toBeNull();
    expect(r.ineligible[0].reason).toMatch(/not listed/);
  });
});
