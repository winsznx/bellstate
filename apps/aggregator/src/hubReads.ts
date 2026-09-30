import type { XLayerPublicClient } from "./chain.js";
import { hubAbi } from "./hubAbi.js";

const SIGNER_CACHE_TTL_MS = 60_000;
const QUORUM_CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Module-level, per-isolate caches — not request state. Cloudflare Workers keep an isolate warm
 * across requests, so caching a value that changes rarely (hub signer membership, hub quorum)
 * here is the standard way to honor "cached 60s" without a KV/DO round trip on every call. A cold
 * isolate just starts with an empty cache and re-fetches once. */
const signerActiveCache = new Map<string, CacheEntry<boolean>>();
let quorumCache: CacheEntry<number> | null = null;

/** PRD §6.5: "Check the signer is active: hub signer set, cached 60 s." Reads BellstateHub's
 * isSigner(address) view live and caches the per-address result for 60 seconds. */
export async function isSignerActiveCached(
  client: XLayerPublicClient,
  hubAddress: `0x${string}`,
  signer: `0x${string}`,
  now: number = Date.now(),
): Promise<boolean> {
  const key = signer.toLowerCase();
  const cached = signerActiveCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const active = await client.readContract({
    address: hubAddress,
    abi: hubAbi,
    functionName: "isSigner",
    args: [signer],
  });
  signerActiveCache.set(key, { value: active, expiresAt: now + SIGNER_CACHE_TTL_MS });
  return active;
}

export async function quorumCached(
  client: XLayerPublicClient,
  hubAddress: `0x${string}`,
  now: number = Date.now(),
): Promise<number> {
  if (quorumCache && quorumCache.expiresAt > now) return quorumCache.value;

  const value = await client.readContract({ address: hubAddress, abi: hubAbi, functionName: "quorum" });
  quorumCache = { value, expiresAt: now + QUORUM_CACHE_TTL_MS };
  return value;
}
