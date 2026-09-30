import { describe, expect, it, vi } from "vitest";
import { deliverWebhook } from "../src/webhookDelivery.js";

describe("deliverWebhook — PRD §8.5/§10.5: 10s timeout, 2xx-only success, no redirects", () => {
  it("reports success when #given a 2xx response", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    // #when
    const result = await deliverWebhook("https://example.com/hook", { id: "evt_1" }, "evt_1", fetchFn);
    // #then
    expect(result).toEqual({ ok: true, httpStatus: 204 });
  });

  it("reports failure when #given a non-2xx response", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    // #when
    const result = await deliverWebhook("https://example.com/hook", { id: "evt_1" }, "evt_1", fetchFn);
    // #then
    expect(result).toEqual({ ok: false, httpStatus: 500 });
  });

  it("sends the raw JSON body, the event id header, and never a signature header (the documented secret-hash gap)", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const payload = { id: "evt_1", type: "halt.opened" };
    // #when
    await deliverWebhook("https://example.com/hook", payload, "evt_1", fetchFn);
    // #then
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/hook");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.body).toBe(JSON.stringify(payload));
    const headers = init.headers as Record<string, string>;
    expect(headers["Bellstate-Event-Id"]).toBe("evt_1");
    expect(headers["Bellstate-Signature"]).toBeUndefined();
  });

  it("reports the underlying error when #given a fetch rejection", async () => {
    // #given
    const fetchFn = vi.fn().mockRejectedValue(new Error("dns lookup failed"));
    // #when
    const result = await deliverWebhook("https://example.com/hook", { id: "evt_1" }, "evt_1", fetchFn);
    // #then
    expect(result.ok).toBe(false);
    expect(result.error).toBe("dns lookup failed");
  });

  it("aborts and reports a timeout when #given a request that never resolves", async () => {
    // #given
    vi.useFakeTimers();
    const neverResolvingFetch = vi.fn().mockImplementation(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );

    // #when
    const pending = deliverWebhook("https://example.com/hook", { id: "evt_1" }, "evt_1", neverResolvingFetch);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    // #then
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timed out");
    vi.useRealTimers();
  });
});
