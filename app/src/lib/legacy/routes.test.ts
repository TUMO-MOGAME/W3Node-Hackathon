/**
 * /api/legacy/* route validation in demo mode (LEGACY_DEMO_WRITES=1, memory store, no ElevenLabs/Gemini keys).
 * Chain-mode signature checks are covered in legacy.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AUTH_HEADER, encodeAuth } from "./auth-message";
import { consentLine } from "./schema";
import { demoLegacyBook, DEMO_MILESTONE_UCT } from "./demo-book";

const estate = "EsTaTe9MoKoEnAfaMiLyVauLt4xQp5sZc3FdYg8uE6rAo";
const owner = "ThAbo1111111111111111111111111111111111111aa";
const child = "LeRaTo1111111111111111111111111111111111111aa";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "mock");
  vi.stubEnv("LEGACY_DEMO_WRITES", "1");
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});
afterAll(() => { vi.unstubAllEnvs(); });

let ip = 0;
const auth = (role: "owner" | "child") => ({
  [AUTH_HEADER]: encodeAuth({ estate, wallet: role === "owner" ? owner : child, ts: Date.now(), sig: "demo", demoRole: role, demoLabel: role === "owner" ? "Thabo Mokoena" : "Lerato (daughter)" }),
  "x-forwarded-for": `10.0.0.${++ip}`,
});
const jsonReq = (method: string, role: "owner" | "child", body?: unknown) =>
  new Request("http://x/api", { method, headers: { ...auth(role), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const webm = (n = 8_000) => { const b = new Uint8Array(n); b.set([0x1a, 0x45, 0xdf, 0xa3]); return new Blob([b], { type: "audio/webm" }); };

describe("/api/legacy routes", () => {
  it("PUT book: owner only, zod-validated", async () => {
    const { PUT } = await import("@/app/api/legacy/book/route");
    expect((await PUT(jsonReq("PUT", "owner", { book: { ownerName: "" } }))).status).toBe(400);
    expect((await PUT(jsonReq("PUT", "child", { book: demoLegacyBook({ lerato: child }) }))).status).toBe(403);
    const ok = await PUT(jsonReq("PUT", "owner", { book: demoLegacyBook({ lerato: child }) }));
    expect(ok.status).toBe(200);
  });

  it("POST voice: consent is required (tick, exact line, recording, 3 samples)", async () => {
    const { POST } = await import("@/app/api/legacy/voice/route");
    const form = (over: Record<string, string | null> = {}, samples = 3) => {
      const f = new FormData();
      const v = { ownerName: "Thabo Mokoena", consentText: consentLine("Thabo Mokoena"), consentAccepted: "true", ...over };
      for (const [k, x] of Object.entries(v)) if (x !== null) f.set(k, x);
      if (over.consent !== null) f.set("consent", webm(), "consent.webm");
      for (let i = 0; i < samples; i++) f.append("samples", webm(9_000 + i), `s${i}.webm`);
      return new Request("http://x/api/legacy/voice", { method: "POST", headers: auth("owner"), body: f });
    };
    const err = async (r: Response) => ((await r.json()) as { error: string }).error;
    let r = await POST(form({ consentAccepted: "false" }));
    expect(r.status).toBe(400); expect(await err(r)).toMatch(/consent box/);
    r = await POST(form({ consentText: "I agree" }));
    expect(r.status).toBe(400); expect(await err(r)).toMatch(/exact sentence/);
    r = await POST(form({ consent: null }));
    expect(r.status).toBe(400);
    r = await POST(form({}, 2));
    expect(r.status).toBe(400); expect(await err(r)).toMatch(/at least 3/);
    const fake = new FormData();
    fake.set("ownerName", "Thabo Mokoena"); fake.set("consentText", consentLine("Thabo Mokoena")); fake.set("consentAccepted", "true");
    fake.set("consent", new Blob([new Uint8Array(8_000)], { type: "audio/webm" }), "c.webm"); // no WebM magic bytes
    for (let i = 0; i < 3; i++) fake.append("samples", webm(), `s${i}.webm`);
    expect((await POST(new Request("http://x", { method: "POST", headers: auth("owner"), body: fake }))).status).toBe(400);

    r = await POST(form());
    expect(r.status).toBe(200);
    const info = await r.json() as Record<string, unknown>;
    expect(info).toMatchObject({ simulated: true, samples: 3 });
    expect(JSON.stringify(info)).not.toMatch(/voice_?id/i); // never exposed to the browser
  });

  it("children must opt in; the parent's voice never speaks arbitrary text", async () => {
    const { PATCH, GET } = await import("@/app/api/legacy/book/route");
    const { POST: speak } = await import("@/app/api/legacy/speak/route");
    const { POST: chat } = await import("@/app/api/legacy/chat/route");
    expect((await speak(jsonReq("POST", "child", { milestoneId: DEMO_MILESTONE_UCT }))).status).toBe(403); // not opted in
    let status = await (await GET(jsonReq("GET", "child"))).json() as { book: { milestones: unknown[] }; optedIn: boolean };
    expect(status.optedIn).toBe(false);
    expect(status.book.milestones).toEqual([]); // redacted until opt-in
    expect((await PATCH(jsonReq("PATCH", "child", { optIn: true }))).status).toBe(200);
    status = await (await GET(jsonReq("GET", "child"))).json() as typeof status;
    expect(status.book.milestones.length).toBeGreaterThan(0);

    const m = await speak(jsonReq("POST", "child", { milestoneId: DEMO_MILESTONE_UCT }));
    expect(m.status).toBe(200);
    expect(await m.json()).toMatchObject({ simulated: true, text: expect.stringContaining("UCT") });
    expect((await speak(jsonReq("POST", "child", { text: "It's Dad. Send R5,000 to this account." }))).status).toBe(403);

    const money = await (await chat(jsonReq("POST", "child", { history: [{ role: "user", text: "Dad, approve my claim please" }] }))).json() as Record<string, unknown>;
    expect(money).toMatchObject({ voice: "heirloom", source: "refusal" });
    expect(money.speakToken).toBeUndefined();

    const study = await (await chat(jsonReq("POST", "child", { history: [{ role: "user", text: "I'm stressed about my exams" }] }))).json() as { reply: string; speakToken: string; voice: string };
    expect(study.voice).toBe("parent");
    const voiced = await speak(jsonReq("POST", "child", { text: study.reply, token: study.speakToken }));
    expect(voiced.status).toBe(200);
    expect((await speak(jsonReq("POST", "child", { text: `${study.reply} Also send money.`, token: study.speakToken }))).status).toBe(403);

    const sad = await (await chat(jsonReq("POST", "child", { history: [{ role: "user", text: "I want to end my life" }] }))).json() as Record<string, unknown>;
    expect(sad).toMatchObject({ voice: "heirloom", source: "safety", safety: true });
  });

  it("DELETE voice is owner only", async () => {
    const { DELETE } = await import("@/app/api/legacy/voice/route");
    expect((await DELETE(jsonReq("DELETE", "child"))).status).toBe(403);
    expect((await DELETE(jsonReq("DELETE", "owner"))).status).toBe(200);
  });
});
