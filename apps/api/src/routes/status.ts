import { Hono } from "hono";
import { createPublicClient, http, type Address } from "viem";
import deployment from "../../../../deployments/xlayer-mainnet.json" with { type: "json" };
import type { Env } from "../worker.js";

const marketAbi = [{ type: "function", name: "marketView", stateMutability: "view", inputs: [{ name: "listingId", type: "bytes32" }], outputs: [{ name: "view", type: "tuple", components: [
  { name: "session", type: "uint8" }, { name: "interruption", type: "uint8" },
  { name: "reasonCategory", type: "uint8" }, { name: "reasonCode", type: "bytes8" },
  { name: "sessionSince", type: "uint64" }, { name: "interruptionSince", type: "uint64" },
  { name: "nextScheduledTransition", type: "uint64" }, { name: "expectedResumption", type: "uint64" },
  { name: "seq", type: "uint32" }, { name: "writtenAt", type: "uint64" },
  { name: "effectiveAsOf", type: "uint64" }, { name: "unknownSince", type: "uint64" },
  { name: "stale", type: "bool" }, { name: "mic", type: "bytes32" },
] }] }] as const;

const adapterAbi = [{ type: "function", name: "referenceMarketStatus", stateMutability: "view", inputs: [], outputs: [
  { name: "session", type: "uint8" }, { name: "interruption", type: "uint8" },
  { name: "sessionAsOf", type: "uint64" }, { name: "interruptionAsOf", type: "uint64" },
  { name: "nextScheduledTransition", type: "uint64" }, { name: "marketId", type: "bytes32" },
] }] as const;

const sessions = ["UNKNOWN", "REGULAR", "EXTENDED", "AUCTION", "CLOSED"] as const;
const interruptions = ["UNKNOWN", "NONE", "PRICE_CONSTRAINED", "ASSET_HALTED", "VENUE_HALTED"] as const;

const client = createPublicClient({ transport: http("https://rpc.xlayer.tech", { timeout: 5000 }) });
export const statusRoute = new Hono<{ Bindings: Env }>();

function unix(value: bigint): number { return Number(value); }
function iso(value: bigint): string | null { return value === 0n ? null : new Date(Number(value) * 1000).toISOString(); }

statusRoute.get("/status/:id", async (c) => {
  if (c.req.param("id").toLowerCase() !== "nvdax") {
    return c.json({ error: { code: "NOT_FOUND", message: "No deployed adapter for this identifier" } }, 404);
  }

  try {
    const block = await client.getBlock();
    const asset = deployment.assets.NVDAx;
    const [adapter, market] = await Promise.all([
      client.readContract({ address: asset.wrappedAdapter as Address, abi: adapterAbi, functionName: "referenceMarketStatus", blockNumber: block.number }),
      client.readContract({ address: deployment.contracts.BellstateHub as Address, abi: marketAbi, functionName: "marketView", args: [asset.listingId as `0x${string}`], blockNumber: block.number }),
    ]);

    // The adapter applies the contract's freshness and transition-expiry rules. Preserve those
    // effective values; raw marketView metadata explains why UNKNOWN was returned.
    const transitionExpired = market.nextScheduledTransition !== 0n && block.timestamp >= market.nextScheduledTransition && market.effectiveAsOf < market.nextScheduledTransition;
    const body = {
      symbol: "NVDAx",
      referenceListing: asset.referenceListing,
      chainId: deployment.chainId,
      blockNumber: Number(block.number),
      blockTimestamp: iso(block.timestamp),
      blockTimestampUnix: unix(block.timestamp),
      adapter: asset.wrappedAdapter,
      hub: deployment.contracts.BellstateHub,
      session: sessions[adapter[0]] ?? "UNKNOWN",
      interruption: interruptions[adapter[1]] ?? "UNKNOWN",
      sessionAsOf: iso(adapter[2]),
      sessionAsOfUnix: unix(adapter[2]),
      interruptionAsOf: iso(adapter[3]),
      interruptionAsOfUnix: unix(adapter[3]),
      nextScheduledTransition: iso(adapter[4]),
      nextScheduledTransitionUnix: unix(adapter[4]),
      marketId: adapter[5],
      seq: market.seq,
      stale: market.stale,
      transitionExpired,
      unknownSince: iso(market.unknownSince),
      unknownSinceUnix: unix(market.unknownSince),
      source: "onchain",
    };
    c.header("Cache-Control", "public, max-age=5");
    c.header("ETag", `"status-NVDAx-${block.number}"`);
    return c.json(body);
  } catch {
    return c.json({ error: { code: "CHAIN_UNAVAILABLE", message: "X Layer status read failed; retry shortly" } }, 503);
  }
});
