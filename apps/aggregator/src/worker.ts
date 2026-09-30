import { bellstateDomain, recoverSigner } from "@winsznx/bellstate-protocol";
import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import {
  digestForBody,
  messageEpoch,
  messageSeq,
  messageSubject,
  parseAttestationBody,
  subjectHex32,
} from "./attestation.js";
import { publicClientFor, requireHubAddress } from "./chain.js";
import type { Env } from "./env.js";
import { isSignerActiveCached, quorumCached } from "./hubReads.js";
import { isRateLimited } from "./rateLimiter.js";
import { recordAttestation } from "./supabaseRecords.js";

export type { Env };
export { AttestationStore } from "./attestationStore.js";

const ATTESTATION_STORE_NAME = "default";

const app = new Hono<{ Bindings: Env }>();

/** PRD §8.2: "Auth. None on intake. Messages are signed, so a forged POST is dropped at signature
 * recovery. Rate limit: 50 req/s per source IP." */
app.post("/v1/attestations", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  if (isRateLimited(ip)) {
    return c.json({ error: { code: "RATE_LIMITED", message: "too many requests" } }, 429);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: { code: "INVALID_JSON", message: "body must be valid JSON" } }, 400);
  }

  const parsed = parseAttestationBody(raw);
  if (!parsed.ok) {
    return c.json({ error: { code: "INVALID_BODY", message: parsed.error } }, 400);
  }
  const body = parsed.value;

  const hubAddress = requireHubAddress(c.env);
  const client = publicClientFor(c.env);
  const domain = bellstateDomain(hubAddress);
  const digest = digestForBody(domain, body);

  let signer: `0x${string}`;
  try {
    signer = await recoverSigner(digest, body.signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "BAD_SIGNATURE", message: `could not recover a signer: ${message}` } }, 400);
  }

  const active = await isSignerActiveCached(client, hubAddress, signer);
  if (!active) {
    return c.json({ error: { code: "UNKNOWN_SIGNER", message: `${signer} is not an active hub signer` } }, 400);
  }

  const seq = messageSeq(body);
  const epoch = messageEpoch(body);

  const stub = c.env.ATTESTATION_STORE.getByName(ATTESTATION_STORE_NAME);
  await stub.ingest({
    digest,
    signer,
    signature: body.signature,
    kind: body.kind,
    subject: messageSubject(body),
    seq,
    epoch: epoch.toString(),
    message: body.message,
  });

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  await recordAttestation(supabase, {
    signer,
    kind: body.kind,
    subjectId: subjectHex32(body),
    seq,
    epoch,
    digest,
    message: body.message,
    signature: body.signature,
    observedAt: new Date(),
  }).catch((err: unknown) => {
    // Non-fatal: DO storage above is the protocol-critical write. Supabase only backs the
    // indexer's latency reporting, so a Supabase outage shouldn't block attestation intake.
    console.error("failed to record attestation in Supabase", err);
  });

  return c.json({ digest, signer }, 202);
});

/**
 * Not in the PRD's endpoint tables — a liveness/readiness check proving the Worker can reach both
 * of its real external dependencies, matching apps/api's /health pattern.
 */
app.get("/health", async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error: supabaseError } = await supabase.from("attestations").select("id", { count: "exact", head: true });

  let hubError: string | null = null;
  try {
    const client = publicClientFor(c.env);
    await quorumCached(client, requireHubAddress(c.env));
  } catch (err) {
    hubError = err instanceof Error ? err.message : String(err);
  }

  const ok = !supabaseError && hubError === null;
  return c.json(
    {
      ok,
      supabase: supabaseError ? { ok: false, error: supabaseError.message } : { ok: true },
      hub: hubError === null ? { ok: true } : { ok: false, error: hubError },
    },
    ok ? 200 : 503,
  );
});

export default app;
