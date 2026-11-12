/** estateFacts: what the legacy voice may say about a child's progress (only that child's rules and claims). */
import { describe, expect, it } from "vitest";
import { estateFacts } from "./server/service";
import type { EstateSnapshot } from "../service/types";

const LERATO = "LeRaTo1111111111111111111111111111111111111aa";
const SIPHO = "SiPhO11111111111111111111111111111111111111aa";
const UCT = "UcT111111111111111111111111111111111111111aa";
const RES = "ReS111111111111111111111111111111111111111aa";
const usd = (n: number) => BigInt(n) * BigInt(1_000_000);
const rule = (o: Partial<EstateSnapshot["rules"][number]>) => ({
  address: "r", id: 0, beneficiary: LERATO, category: "Tuition", allowedPayeeKind: "University", maxPerClaim: usd(4000),
  lifetimeCap: usd(16000), spentTotal: usd(1005), validUntil: 0, startsNow: false, recurringAmount: BigInt(0), intervalSecs: 0,
  nextDue: null, fixedPayee: null, ...o,
});

const snap = {
  estate: { status: "Unlocked" },
  payees: [{ wallet: UCT, name: "University of Cape Town" }, { wallet: RES, name: "Tugwell Residence" }],
  claims: [{ beneficiary: LERATO, amount: usd(1000), payee: UCT, status: "Paid" }],
  rules: [
    rule({}),
    rule({ category: "Accommodation", recurringAmount: usd(300), fixedPayee: RES, spentTotal: usd(1500), lifetimeCap: usd(9000) }),
    rule({ beneficiary: SIPHO, spentTotal: usd(0) }),
  ],
  assets: [{ status: "Sold" }],
} as unknown as EstateSnapshot;

describe("legacy estateFacts", () => {
  it("tells the voice how far this child is under each of their rules, and nothing about a sibling's", () => {
    const facts = estateFacts(snap, LERATO).join("\n");
    expect(facts).toMatch(/unlocked/);
    expect(facts).toMatch(/1\s000 USD₮ claim to University of Cape Town is paid/);
    expect(facts).toMatch(/Tuition: 1\s005 USD₮ of 16\s000 USD₮ used so far/);
    expect(facts).toMatch(/Accommodation: 300 USD₮ is paid automatically to Tugwell Residence/);
    expect(facts).toMatch(/car is sold/);
    expect(facts.match(/Tuition:/g)).toHaveLength(1); // Sipho's tuition rule is not included
  });
});
