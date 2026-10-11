import { describe, expect, it, vi } from "vitest";
import { deliverWebhook } from "../src/webhookDelivery.js";
import { encryptWebhookSecret, signWebhookPayload } from "@winsznx/bellstate-protocol";

const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const secret = "whsec_test";
const ciphertext = encryptWebhookSecret(secret, "sub_1", encryptionKey);
const deliver = (url: string, payload: unknown, eventId: string, fetchFn: typeof fetch) =>
  deliverWebhook(url, payload, eventId, ciphertext, "sub_1", encryptionKey, fetchFn);

describe("deliverWebhook — PRD §8.5/§10.5: 10s timeout, 2xx-only success, no redirects", () => {
  it("reports success when #given a 2xx response", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    // #when
    const result = await deliver("https://example.com/hook", { id: "evt_1" }, "evt_1", fetchFn);
    // #then
    expect(result).toEqual({ ok: true, httpStatus: 204 });
  });

  it("reports failure when #given a non-2xx response", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    // #when
    const result = await deliver("https://example.com/hook", { id: "evt_1" }, "evt_1", fetchFn);
    // #then
    expect(result).toEqual({ ok: false, httpStatus: 500 });
  });

  it("sends a verifiable signature over the exact raw JSON body", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const payload = { id: "evt_1", type: "halt.opened" };
    // #when
    await deliver("https://example.com/hook", payload, "evt_1", fetchFn);
    // #then
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/hook");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.body).toBe(JSON.stringify(payload));
    const headers = init.headers as Record<string, string>;
    expect(headers["Bellstate-Event-Id"]).toBe("evt_1");
    const timestamp = Number(/^t=(\d+),/.exec(headers["Bellstate-Signature"]!)?.[1]);
    expect(Math.abs(Math.floor(Date.now() / 1000) - timestamp)).toBeLessThanOrEqual(1);
    expect(headers["Bellstate-Signature"]).toBe(signWebhookPayload(secret, timestamp, init.body as string));
  });

  it("reports the underlying error when #given a fetch rejection", async () => {
    // #given
    const fetchFn = vi.fn().mockRejectedValue(new Error("dns lookup failed"));
    // #when
    const result = await deliver("https://example.com/hook", { id: "evt_1" }, "evt_1", fetchFn);
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
    const pending = deliver("https://example.com/hook", { id: "evt_1" }, "evt_1", neverResolvingFetch);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    // #then
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timed out");
    vi.useRealTimers();
  });
});
