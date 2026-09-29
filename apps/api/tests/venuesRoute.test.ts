import { describe, expect, it, vi } from "vitest";

// Mocks @supabase/supabase-js so this stays a fast unit test — the real live wiring is already
// proven by the manual deployment verification (BUILDLOG) and packages/calendars' own test
// suite covers resolveSessionWindow's correctness independently.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          returns: async () => ({
            data: [{ mic: "XNAS", name: "Nasdaq", tz: "America/New_York", family: "US", currency: "USD" }],
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

const { venuesRoute } = await import("../src/routes/venues.js");

describe("GET /venues route", () => {
  it("returns venues with a computed session and Cache-Control/ETag headers (§10.1/§10.2)", async () => {
    const res = await venuesRoute.request("/venues", {}, { SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "y" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=5");
    expect(res.headers.get("ETag")).toMatch(/^"venues-\d+"$/);

    const body = await res.json();
    expect(body.venues).toHaveLength(1);
    expect(body.venues[0].mic).toBe("XNAS");
    expect(["REGULAR", "EXTENDED", "AUCTION", "CLOSED", "UNKNOWN"]).toContain(body.venues[0].session);
    expect(typeof body.venues[0].nextScheduledTransitionUnix).toBe("number");
  });
});
