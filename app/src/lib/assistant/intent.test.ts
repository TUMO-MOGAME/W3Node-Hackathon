import { describe, expect, it } from "vitest";
import { groundIntent, looksLikeSend, matchRecipients, parseIntentFallback, planSend, walletIntentSchema, type RecipientLike } from "./intent";

const PEOPLE: RecipientLike[] = [
  { label: "Lerato Mokoena", address: "LeRaTo1111111111111111111111111111111111111", relationship: "daughter, 20" },
  { label: "Sipho Mokoena", address: "SiPho11111111111111111111111111111111111111", relationship: "son, 18" },
  { label: "Naledi Mokoena", address: "NaLedi1111111111111111111111111111111111111", relationship: "daughter, 15" },
  { label: "Adv. Thandi Ndlovu", address: "ThAndi1111111111111111111111111111111111111", relationship: "executor" },
];

describe("parseIntentFallback", () => {
  it("reads the brief's example: rand, saved name, memo", () => {
    expect(parseIntentFallback("send R500 to Lerato for books", PEOPLE)).toEqual({
      action: "send", recipient: "Lerato Mokoena", amountUsdt: null, amountZar: 500, memo: "books",
    });
  });

  it.each([
    ["pay Sipho 20 USDT", { amountUsdt: 20, amountZar: null }],
    ["give Sipho 12.50 USD₮", { amountUsdt: 12.5, amountZar: null }],
    ["send $40 to Sipho", { amountUsdt: 40, amountZar: null }],
    ["send 15 dollars to Sipho", { amountUsdt: 15, amountZar: null }],
    ["transfer 1 500 rand to Sipho", { amountUsdt: null, amountZar: 1500 }],
    ["send R1,250.75 to Sipho", { amountUsdt: null, amountZar: 1250.75 }],
    ["send 300 ZAR to Sipho", { amountUsdt: null, amountZar: 300 }],
    ["send R2k to Sipho", { amountUsdt: null, amountZar: 2000 }],
    ["send Sipho 25", { amountUsdt: 25, amountZar: null }],
  ])("%s", (text, amounts) => {
    const i = parseIntentFallback(text, PEOPLE);
    expect(i.action).toBe("send");
    expect(i.recipient).toBe("Sipho Mokoena");
    expect({ amountUsdt: i.amountUsdt, amountZar: i.amountZar }).toEqual(amounts);
  });

  it("finds a name after 'to' when nobody is saved", () => {
    expect(parseIntentFallback("send R100 to Zola for taxi fare").recipient).toBe("Zola");
  });

  it("finds a capitalised name straight after the verb", () => {
    expect(parseIntentFallback("pay Zola 20 USDT").recipient).toBe("Zola");
    expect(parseIntentFallback("send R50 to my brother").recipient).toBe("brother");
  });

  it("does not take a person for a memo", () => {
    expect(parseIntentFallback("pay R200 for Lerato", PEOPLE)).toMatchObject({ recipient: "Lerato Mokoena", memo: null });
  });

  it("accepts a pasted wallet address", () => {
    const addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
    expect(parseIntentFallback(`send 5 USDT to ${addr}`).recipient).toBe(addr);
  });

  it("is 'unknown' for something that is not a payment", () => {
    expect(parseIntentFallback("what is my balance?", PEOPLE).action).toBe("unknown");
    expect(parseIntentFallback("", PEOPLE).action).toBe("unknown");
  });

  it("always matches the shared schema", () => {
    for (const t of ["send R500 to Lerato for books", "hello", "pay 9 to my son"]) {
      expect(walletIntentSchema.safeParse(parseIntentFallback(t, PEOPLE)).success).toBe(true);
    }
  });
});

describe("matchRecipients", () => {
  it("matches a relationship, and reports ambiguity", () => {
    expect(matchRecipients("my son", PEOPLE).map((p) => p.label)).toEqual(["Sipho Mokoena"]);
    expect(matchRecipients("my daughter", PEOPLE)).toHaveLength(2);
    expect(matchRecipients("Thandi", PEOPLE)[0].label).toBe("Adv. Thandi Ndlovu");
  });
});

describe("groundIntent (model output check)", () => {
  it("replaces an amount the model invented", () => {
    const model = { action: "send" as const, recipient: "Lerato", amountUsdt: 5000, amountZar: null, memo: "books" };
    expect(groundIntent(model, "send R500 to Lerato for books", PEOPLE)).toMatchObject({ amountZar: 500, amountUsdt: null });
  });

  it("replaces a recipient the model invented", () => {
    const model = { action: "send" as const, recipient: "Bob", amountUsdt: null, amountZar: 500, memo: null };
    expect(groundIntent(model, "send R500 to Lerato", PEOPLE).recipient).toBe("Lerato Mokoena");
  });

  it("keeps a grounded model answer", () => {
    const model = { action: "send" as const, recipient: "Lerato", amountUsdt: null, amountZar: 500, memo: "books for varsity" };
    expect(groundIntent(model, "please send Lerato R500, it's for books for varsity", PEOPLE)).toEqual(model);
  });
});

describe("planSend", () => {
  it("resolves the person and converts ZAR to USD₮ at the live rate", () => {
    const plan = planSend(parseIntentFallback("send R500 to Lerato for books", PEOPLE), PEOPLE, 18.5);
    expect(plan).toEqual({ ok: true, to: PEOPLE[0].address, toLabel: "Lerato Mokoena", amountUsdt: 27.03, amountZar: 500, memo: "books" });
  });

  it("asks which daughter", () => {
    const plan = planSend(parseIntentFallback("send 10 USDT to my daughter", PEOPLE), PEOPLE, 18);
    expect(plan.ok).toBe(false);
    if (!plan.ok) { expect(plan.reason).toBe("ambiguous"); expect(plan.candidates).toHaveLength(2); }
  });

  it.each([
    ["send R500 to Zola", "no_recipient", 18],
    ["send something to Lerato", "no_amount", 18],
    ["send R500 to Lerato", "no_rate", null],
    ["how are you", "not_send", 18],
  ] as const)("%s → %s", (text, reason, rate) => {
    const plan = planSend(parseIntentFallback(text, PEOPLE), PEOPLE, rate);
    expect(plan.ok ? "ok" : plan.reason).toBe(reason);
  });
});

describe("looksLikeSend", () => {
  it("flags payment requests only", () => {
    expect(looksLikeSend("send R500 to Lerato for books")).toBe(true);
    expect(looksLikeSend("how does the will work?")).toBe(false);
    expect(looksLikeSend("can I claim fees for books?")).toBe(false);
  });
});
