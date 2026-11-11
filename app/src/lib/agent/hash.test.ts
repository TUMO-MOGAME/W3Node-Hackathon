import { describe, expect, it } from "vitest";
import { canonicalJson, hashJson, sha256Hex } from "./hash";
import { finalizeReport } from "./review";

describe("hashing convention", () => {
  it("sha256 of bytes matches the standard test vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("canonical JSON sorts keys recursively, drops undefined, no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("hash is independent of key order", async () => {
    expect(await hashJson({ a: 1, b: 2 })).toBe(await hashJson({ b: 2, a: 1 }));
  });
});

describe("AgentReport hashing", () => {
  const model = {
    verdict: "approve" as const, documentType: "fee_statement", confidence: 0.912,
    extracted: [{ field: "institution", value: "UCT" }, { field: "amount", value: "R45 000" }],
    redFlags: [], summary: "Looks right.",
  };

  it("reportHash = sha256(canonical JSON of the report without its hash)", async () => {
    const r = await finalizeReport(model);
    const { reportHash, ...body } = r;
    expect(reportHash).toBe(await hashJson(body));
    expect(r.extracted).toEqual({ institution: "UCT", amount: "R45 000" });
    expect(r.confidence).toBe(0.91);
  });

  it("any change to the report changes the hash", async () => {
    const a = await finalizeReport(model);
    const b = await finalizeReport({ ...model, redFlags: ["edited amount"] });
    expect(a.reportHash).not.toBe(b.reportHash);
  });
});
