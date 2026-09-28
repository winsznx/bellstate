import type { SupabaseClient } from "@supabase/supabase-js";
import { checkWebhookUrl } from "./webhookUrl.js";
import { generateWebhookSecret, hashWebhookSecret, signWebhookPayload } from "./webhookSignature.js";
import type { WebhookFilters } from "./filters.js";

export interface CreateWebhookResult {
  ok: true;
  id: string;
  secret: string;
}
export interface CreateWebhookRejection {
  ok: false;
  reason: string;
}

/** PRD §10.5 POST /webhooks. Re-validates the URL (the same check runs again at delivery time,
 * since a hostname's resolution can change after creation). */
export async function createWebhook(
  supabase: SupabaseClient,
  owner: `0x${string}`,
  url: string,
  filters: WebhookFilters,
): Promise<CreateWebhookResult | CreateWebhookRejection> {
  const urlCheck = await checkWebhookUrl(url);
  if (!urlCheck.ok) {
    return { ok: false, reason: urlCheck.rejection ?? "INVALID_URL" };
  }

  const secret = generateWebhookSecret();
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      channel: "webhook",
      owner,
      target: url,
      filters,
      secret_hash: hashWebhookSecret(secret),
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, reason: error?.message ?? "insert failed" };
  }

  return { ok: true, id: data.id as string, secret };
}

export interface WebhookRow {
  id: string;
  target: string;
  filters: WebhookFilters;
  status: string;
  consecutive_failures: number;
  created_at: string;
}

/** Never selects secret_hash — the secret is shown once at creation only, per §10.5. */
export async function listWebhooks(supabase: SupabaseClient, owner: `0x${string}`): Promise<WebhookRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, target, filters, status, consecutive_failures, created_at")
    .eq("channel", "webhook")
    .eq("owner", owner)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as WebhookRow[];
}

export async function deleteWebhook(supabase: SupabaseClient, owner: `0x${string}`, id: string): Promise<boolean> {
  const { error, count } = await supabase
    .from("subscriptions")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("owner", owner)
    .eq("channel", "webhook");
  return !error && (count ?? 0) > 0;
}

export interface TestWebhookResult {
  ok: boolean;
  httpStatus?: number;
  latencyMs: number;
  error?: string;
}

/**
 * PRD §10.5: "Test. POST /webhooks/{id}/test sends a webhook.test event." Records the attempt
 * to `deliveries` regardless of outcome, and never follows a redirect (the URL-validation rule
 * applies at delivery, not just creation).
 */
export async function testWebhook(
  supabase: SupabaseClient,
  owner: `0x${string}`,
  id: string,
  fetchFn: typeof fetch = fetch,
): Promise<TestWebhookResult | { ok: false; error: "NOT_FOUND" }> {
  const { data: sub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, target, secret_hash")
    .eq("id", id)
    .eq("owner", owner)
    .eq("channel", "webhook")
    .maybeSingle();

  if (fetchError || !sub) return { ok: false, error: "NOT_FOUND" };

  const urlCheck = await checkWebhookUrl(sub.target as string);
  const eventId = `evt_test_${Date.now()}`;
  const body = JSON.stringify({
    id: eventId,
    type: "webhook.test",
    createdAt: new Date().toISOString(),
    data: {},
  });

  const start = Date.now();
  let httpStatus: number | undefined;
  let error: string | undefined;

  if (!urlCheck.ok) {
    error = `url rejected: ${urlCheck.rejection}`;
  } else {
    // The secret is stored only as a hash and can't be recovered here to sign a real test
    // delivery — a real deployment keeps a lookup path for this (e.g. a KV of id -> secret at
    // creation, or re-prompting the owner). This gap is intentional and documented rather than
    // worked around by weakening the "secret is hashed, shown once" rule.
    try {
      const response = await fetchFn(sub.target as string, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "Bellstate-Event-Id": eventId,
          "Bellstate-Signature": signWebhookPayload("placeholder-until-secret-lookup-exists", Math.floor(Date.now() / 1000), body),
        },
        body,
      });
      httpStatus = response.status;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const latencyMs = Date.now() - start;
  const status = httpStatus !== undefined && httpStatus >= 200 && httpStatus < 300 ? "success" : "failed";

  await supabase.from("deliveries").insert({
    subscription_id: id,
    event_id: eventId,
    attempt: 1,
    status,
    http_status: httpStatus ?? null,
    latency_ms: latencyMs,
    error: error ?? null,
  });

  return { ok: status === "success", httpStatus, latencyMs, error };
}
