import { afterEach, describe, expect, it } from "vitest";
import { buildMessages, interpret, qvacEnabled } from "./qvac";

const PEOPLE = [{ label: "Lerato Mokoena", address: "LeRaTo1111111111111111111111111111111111111", relationship: "daughter, 20" }];
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("qvacEnabled", () => {
  it("is on locally, off on Vercel, and can be forced either way", () => {
    expect(qvacEnabled({})).toBe(true);
    expect(qvacEnabled({ VERCEL: "1" })).toBe(false);
    expect(qvacEnabled({ VERCEL: "1", QVAC_ENABLED: "1" })).toBe(true);
    expect(qvacEnabled({ QVAC_ENABLED: "0" })).toBe(false);
  });
});

describe("buildMessages", () => {
  it("gives the model the saved names and caps the request", () => {
    const m = buildMessages("x".repeat(900), PEOPLE);
    expect(m[0].content).toContain("Lerato Mokoena (daughter, 20)");
    expect(m[m.length - 1].content).toHaveLength(500);
  });
});

describe("interpret", () => {
  it("uses the labelled fallback on the hosted demo", async () => {
    process.env.VERCEL = "1";
    delete process.env.QVAC_ENABLED;
    const r = await interpret("send R500 to Lerato for books", PEOPLE);
    expect(r.engine).toBe("fallback");
    expect(r.note).toMatch(/QVAC runs locally/);
    expect(r.intent).toMatchObject({ action: "send", recipient: "Lerato Mokoena", amountZar: 500, memo: "books" });
  });

  it("falls back cleanly when QVAC is enabled but cannot load", async () => {
    process.env.QVAC_ENABLED = "1";
    process.env.QVAC_TIMEOUT_MS = "2000";
    const r = await interpret("pay Lerato 20 USDT", PEOPLE);
    expect(r.engine).toBe("fallback");
    expect(r.intent).toMatchObject({ recipient: "Lerato Mokoena", amountUsdt: 20 });
  });
});
