import { afterEach, describe, expect, it, vi } from "vitest";
import { quietRetryFetch } from "./tx";

const reply = (status: number) => new Response("{}", { status });

describe("quietRetryFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries a rate-limited RPC call without logging, then returns the answer", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await quietRetryFetch("https://rpc.test", { method: "POST", body: "{}" }, [0, 0, 0]);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("gives up and returns the 429 when the limit persists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(429));
    vi.stubGlobal("fetch", fetchMock);
    const res = await quietRetryFetch("https://rpc.test", undefined, [0, 0]);
    expect(res.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(500));
    vi.stubGlobal("fetch", fetchMock);
    expect((await quietRetryFetch("https://rpc.test", undefined, [0, 0])).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
