import { describe, expect, it } from "vitest";
import { createMockService, floorFromText } from "./mock";

describe("floorFromText (mock plan builder)", () => {
  it("uses the latest USD₮ amount, so 'change the minimum' takes effect", () => {
    const text = "Sell my Corolla for no less than 9,000 USDT, unless one of the children is in real need. Change the minimum to 9,500 USDT";
    expect(floorFromText(text)).toBe(9500);
  });
  it("ignores small rand amounts and falls back", () => {
    expect(floorFromText("R1,500 a month for Lerato's books")).toBe(9000);
  });
  it("converts a large rand amount", () => {
    expect(floorFromText("no less than R180 000")).toBeGreaterThan(9000);
  });
});

describe("mock willChat", () => {
  it("updates the car floor when the owner changes it", async () => {
    const svc = createMockService();
    const say = (...t: string[]) => t.map((text) => ({ role: "user" as const, text }));
    const res = await svc.willChat(say("kids", "verifiers", "Sell my Corolla for no less than 9,000 USDT", "Change the minimum to 9,500 USDT"), "en");
    expect(res.draft?.assets[0]?.floorPriceUsdt).toBe(9500);
  });
});
