import { describe, expect, it, vi } from "vitest";
import { postToAggregators } from "../src/core/postToAggregators.js";

describe("postToAggregators", () => {
  it("posts the same JSON body to every configured URL", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const results = await postToAggregators("https://a.example/post, https://b.example/post", { hello: "world" }, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://a.example/post",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ hello: "world" }) }),
    );
    expect(results).toEqual([
      { url: "https://a.example/post", ok: true, status: 200 },
      { url: "https://b.example/post", ok: true, status: 200 },
    ]);
  });

  it("reports one aggregator's failure without affecting the others", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    const results = await postToAggregators("https://ok.example, https://down.example", {}, fetchFn);

    expect(results[0]).toEqual({ url: "https://ok.example", ok: true, status: 200 });
    expect(results[1]).toMatchObject({ url: "https://down.example", ok: false });
    expect(results[1]!.error).toMatch(/http_503/);
  });

  it("returns no results for an empty AGGREGATOR_URLS", async () => {
    const fetchFn = vi.fn();
    const results = await postToAggregators("", {}, fetchFn);
    expect(results).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
