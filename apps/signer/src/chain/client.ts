import { createPublicClient, fallback, http } from "viem";
import { HUB_CHAIN_ID } from "../constants.js";

/** Same chain definition apps/signer/scripts/submit-market-update.ts already used for its
 * mainnet-verified attestation. */
export const X_LAYER_CHAIN = {
  id: HUB_CHAIN_ID,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

/** XLAYER_RPC_URLS is comma-separated (see .env.example); a second+ URL becomes a viem
 * `fallback` transport so one RPC provider's outage doesn't stall ChainDO's 5s loop. */
export function createXLayerClient(rpcUrlsCsv: string) {
  const urls = rpcUrlsCsv
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  if (urls.length === 0) {
    throw new Error("XLAYER_RPC_URLS must contain at least one URL");
  }

  const transport = urls.length === 1 ? http(urls[0]) : fallback(urls.map((u) => http(u)));

  return createPublicClient({ chain: X_LAYER_CHAIN, transport });
}
