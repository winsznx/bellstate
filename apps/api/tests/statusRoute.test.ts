import { describe, expect, it, vi } from "vitest";

const readContract = vi.fn();
const getBlock = vi.fn();
vi.mock("viem", () => ({ createPublicClient: () => ({ readContract, getBlock }), http: () => ({}) }));

const { statusRoute } = await import("../src/routes/status.js");

describe("GET /status/:id", () => {
  it("rejects an identifier without a deployed adapter", async () => {
    const response = await statusRoute.request("/status/SKHYx");
    expect(response.status).toBe(404);
    expect(getBlock).not.toHaveBeenCalled();
  });

  it("returns effective adapter status and expiry metadata from one block", async () => {
    getBlock.mockResolvedValue({ number: 123n, timestamp: 2000n });
    readContract.mockImplementation(({ functionName }) => functionName === "referenceMarketStatus"
      ? Promise.resolve([0, 1, 1500n, 1500n, 0n, "0x584e4153"])
      : Promise.resolve({ seq: 2, stale: false, nextScheduledTransition: 1800n, effectiveAsOf: 1500n, unknownSince: 1800n }));
    const response = await statusRoute.request("/status/NVDAx");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=5");
    const body = await response.json();
    expect(body).toMatchObject({ session: "UNKNOWN", interruption: "NONE", blockNumber: 123, stale: false, transitionExpired: true, unknownSinceUnix: 1800 });
    expect(readContract).toHaveBeenCalledTimes(2);
    expect(readContract.mock.calls.every(([options]) => options.blockNumber === 123n)).toBe(true);
  });

  it("returns an honest service error if RPC fails", async () => {
    getBlock.mockRejectedValueOnce(new Error("offline"));
    const response = await statusRoute.request("/status/NVDAx");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "CHAIN_UNAVAILABLE" } });
  });
});
