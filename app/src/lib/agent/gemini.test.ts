import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonSchemaOf } from "./gemini";

const keysOf = (node: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(node)) node.forEach((n) => keysOf(n, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) { out.add(k); keysOf(v, out); }
  return out;
};

describe("jsonSchemaOf", () => {
  const schema = z.object({
    reply: z.string().min(1).max(500),
    actions: z.array(z.object({ label: z.string() })).max(3),
    nested: z.object({ tags: z.array(z.string()).max(5) }),
  });

  it("drops maxItems, which Gemini rejects with 400 INVALID_ARGUMENT", () => {
    const keys = keysOf(jsonSchemaOf(schema));
    expect(keys.has("maxItems")).toBe(false);
    expect(keys.has("$schema")).toBe(false);
  });

  it("keeps the keywords Gemini accepts", () => {
    const s = jsonSchemaOf(schema) as { properties: { reply: { maxLength?: number }; actions: { type?: string } } };
    expect(s.properties.reply.maxLength).toBe(500);
    expect(s.properties.actions.type).toBe("array");
  });

  it("zod still enforces the limit the schema no longer carries", () => {
    expect(schema.safeParse({ reply: "ok", actions: [{ label: "a" }, { label: "b" }, { label: "c" }, { label: "d" }], nested: { tags: [] } }).success).toBe(false);
  });
});
