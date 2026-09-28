import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { createWebhook, deleteWebhook, listWebhooks, testWebhook } from "../src/webhooksService.js";

/**
 * Real integration test against the actual production Supabase project — not a local
 * reproduction. Gated behind RUN_LIVE_TESTS=1 (needs SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in
 * the environment) since it's not something a normal `pnpm test` run should require or touch a
 * shared database for. Run with:
 *
 *   RUN_LIVE_TESTS=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter @winsznx/bellstate-api test:live
 */
const RUN = process.env.RUN_LIVE_TESTS === "1";
const describeIfLive = RUN ? describe : describe.skip;

const OWNER = "0x0000000000000000000000000000000000dead" as const;

describeIfLive("webhooks service — real Supabase project", () => {
  // `describe.skip`'s callback body still runs at collection time (only the `it`s inside are
  // skipped) — createClient() with an empty URL throws immediately, failing the whole file even
  // when RUN_LIVE_TESTS isn't set. Guard the real client behind the same flag; `it` bodies below
  // never execute when skipped, so the non-null assertion is safe there.
  const client: SupabaseClient | null = RUN
    ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    : null;
  const supabase = client!;

  afterAll(async () => {
    // Best-effort cleanup even if an assertion above failed mid-test. `deliveries.subscription_id`
    // references `subscriptions` with no cascade, so deliveries must go first.
    const { data: subs } = await supabase.from("subscriptions").select("id").eq("owner", OWNER);
    const ids = (subs ?? []).map((s) => s.id);
    if (ids.length > 0) {
      await supabase.from("deliveries").delete().in("subscription_id", ids);
    }
    await supabase.from("subscriptions").delete().eq("owner", OWNER);
  });

  it("rejects creating a webhook with a private-IP target before ever touching the database", async () => {
    const result = await createWebhook(supabase, OWNER, "https://localhost/hook", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("PRIVATE_IP");

    const rows = await listWebhooks(supabase, OWNER);
    expect(rows).toHaveLength(0);
  });

  it("creates a real row, lists it back without the secret, then deletes it", async () => {
    const created = await createWebhook(supabase, OWNER, "https://httpbin.org/status/200", {
      types: ["halt.opened"],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.secret).toMatch(/^whsec_[0-9a-f]{48}$/);

    const rows = await listWebhooks(supabase, OWNER);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(created.id);
    expect(rows[0]!.target).toBe("https://httpbin.org/status/200");
    expect(rows[0]).not.toHaveProperty("secret_hash");
    expect(rows[0]).not.toHaveProperty("secret");

    const deleted = await deleteWebhook(supabase, OWNER, created.id);
    expect(deleted).toBe(true);

    const rowsAfter = await listWebhooks(supabase, OWNER);
    expect(rowsAfter).toHaveLength(0);
  }, 20_000);

  it("test delivery makes a real HTTP round trip and records it to `deliveries`", async () => {
    const created = await createWebhook(supabase, OWNER, "https://httpbin.org/status/200", {});
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await testWebhook(supabase, OWNER, created.id);
    expect("error" in result && result.error === "NOT_FOUND").toBe(false);
    if ("httpStatus" in result) {
      expect(result.httpStatus).toBe(200);
      expect(result.ok).toBe(true);
    }

    const { data: deliveryRows } = await supabase
      .from("deliveries")
      .select("id, status, http_status")
      .eq("subscription_id", created.id);
    expect(deliveryRows).toHaveLength(1);
    expect(deliveryRows![0]!.status).toBe("success");
    expect(deliveryRows![0]!.http_status).toBe(200);

    await supabase.from("deliveries").delete().eq("subscription_id", created.id);
    await deleteWebhook(supabase, OWNER, created.id);
  }, 20_000);
});
