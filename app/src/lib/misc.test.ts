import { describe, expect, it } from "vitest";
import { formatUsdt, fromBase, shortAddress, toBase, explorerTx } from "./format";
import { getUsdtZar, parseValrSummary, _resetFxCache, FALLBACK_USDT_ZAR } from "./fx";
import { sniff, validateUpload, UploadError } from "./storage";
import { SimulatedZarPayout } from "./offramp";
import { summarize } from "./agent/valuation";
import { rateLimit, HttpError } from "./api/http";
import { bits } from "./chain/decoders";
import { humanizeProgramError } from "./chain/tx";

describe("format", () => {
  it("converts USD₮ to base units and back (6 dp)", () => {
    expect(toBase(1)).toBe(1_000_000n);
    expect(toBase(9000.5)).toBe(9_000_500_000n);
    expect(toBase(0.1 + 0.2)).toBe(300_000n); // rounding, not float garbage
    expect(fromBase(1_234_567n)).toBeCloseTo(1.234567);
  });
  it("formats amounts and addresses", () => {
    expect(formatUsdt(toBase(1234.5))).toMatch(/1.?234[.,]50 USD₮/);
    expect(shortAddress("ABCDEFGHIJKLMNOP")).toBe("ABCD…MNOP");
    expect(explorerTx("sig", "devnet")).toBe("https://explorer.solana.com/tx/sig?cluster=devnet");
  });
});

describe("fx (VALR)", () => {
  it("parses the market summary mid price", () => {
    expect(parseValrSummary({ askPrice: "16.6987", bidPrice: "16.6986", lastTradedPrice: "16.7" })).toBeCloseTo(16.6987, 3);
    expect(parseValrSummary({ lastTradedPrice: "16.7" })).toBe(16.7);
    expect(parseValrSummary({})).toBeNull();
  });
  it("caches for 60 s and falls back with a label", async () => {
    _resetFxCache();
    let calls = 0;
    const ok = (async () => { calls++; return new Response(JSON.stringify({ askPrice: "17", bidPrice: "17" })); }) as typeof fetch;
    expect((await getUsdtZar(ok, 1_000)).usdtZar).toBe(17);
    await getUsdtZar(ok, 30_000);
    expect(calls).toBe(1);
    _resetFxCache();
    const down = (async () => { throw new Error("offline"); }) as typeof fetch;
    const fb = await getUsdtZar(down, 1_000);
    expect(fb.usdtZar).toBe(FALLBACK_USDT_ZAR);
    expect(fb.source).toMatch(/fallback/);
  });
});

describe("upload validation", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  it("sniffs magic bytes", () => {
    expect(sniff(pdf)).toBe("application/pdf");
    expect(sniff(png)).toBe("image/png");
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniff(new Uint8Array([0x4d, 0x5a]))).toBeNull();
  });
  it("rejects wrong types, mismatched content, empty and oversize files", () => {
    expect(validateUpload(pdf, "application/pdf")).toBe("application/pdf");
    expect(() => validateUpload(pdf, "image/png")).toThrow(UploadError);
    expect(() => validateUpload(pdf, "text/html")).toThrow(/PDF, JPG or PNG/);
    expect(() => validateUpload(new Uint8Array(), "application/pdf")).toThrow(/empty/);
    expect(() => validateUpload(new Uint8Array(10 * 1024 * 1024 + 1), "application/pdf")).toThrow(/10 MB/);
  });
});

describe("simulated off-ramp", () => {
  it("is labelled simulated and converts at the given rate minus fees", async () => {
    const q = await new SimulatedZarPayout(50).quote(
      { claimTx: "5abcdefghijk", amountBase: toBase(1000), institutionName: "UCT", reference: "STU123" },
      { usdtZar: 17, source: "test", fetchedAt: 0 },
    );
    expect(q.simulated).toBe(true);
    expect(q.feeZar).toBe(85);
    expect(q.zarToInstitution).toBe(16_915);
    expect(q.steps.join(" ")).toMatch(/SIMULATED/);
  });
});

describe("valuation summary", () => {
  it("takes median and 20/80 percentiles, converted and rounded to 50 USD₮", () => {
    const s = summarize([170_000, 180_000, 190_000, 200_000, 900_000], 18);
    expect(s.suggested).toBe(10_550); // 190k / 18 = 10,555 → 10,550
    expect(s.low).toBeLessThanOrEqual(s.suggested);
    expect(s.high).toBeGreaterThanOrEqual(s.suggested);
    expect(() => summarize([], 18)).toThrow();
  });
});

describe("rate limit", () => {
  it("allows N per window per IP, then 429", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } });
    for (let i = 0; i < 3; i++) rateLimit(req, "t", 3, 60_000, 1000);
    expect(() => rateLimit(req, "t", 3, 60_000, 1000)).toThrow(HttpError);
    expect(() => rateLimit(req, "t", 3, 60_000, 70_000)).not.toThrow();
    const other = new Request("http://x", { headers: { "x-forwarded-for": "5.6.7.8" } });
    expect(() => rateLimit(other, "t", 3, 60_000, 1000)).not.toThrow();
  });
});

describe("chain helpers", () => {
  it("bitmap → verifier flags", () => expect(bits(0b011)).toEqual([true, true, false]));
  it("extracts the Anchor error from logs", () => {
    expect(humanizeProgramError(["Program log: AnchorError occurred. Error Code: BelowFloor. Error Number: 6016. Error Message: Offer is below the floor price."]))
      .toBe("BelowFloor: Offer is below the floor price");
  });
});
