import { createPublicClient, createWalletClient, fallback, http, type Chain } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Env } from "./env.js";

/** X Layer mainnet — same values as apps/web/app/_lib/chains.ts and packages/contracts'
 * Deploy.s.sol; chain id 196, native currency OKB. Built here rather than imported because this
 * app has no dependency on apps/web. */
export const xLayer: Chain = {
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer" },
  },
};

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export function requireHubAddress(env: Env): `0x${string}` {
  if (!HEX_ADDRESS_RE.test(env.HUB_ADDRESS)) {
    throw new Error(`HUB_ADDRESS is not a valid address: ${env.HUB_ADDRESS}`);
  }
  return env.HUB_ADDRESS as `0x${string}`;
}

function rpcUrls(env: Env): string[] {
  const urls = env.XLAYER_RPC_URLS.split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  if (urls.length === 0) throw new Error("XLAYER_RPC_URLS is empty");
  return urls;
}

/** One fallback transport per Worker invocation — viem's `fallback()` tries each URL in order
 * and moves on when one errors or times out, matching the PRD's "comma-separated" RPC list. */
export function publicClientFor(env: Env) {
  return createPublicClient({
    chain: xLayer,
    transport: fallback(rpcUrls(env).map((url) => http(url))),
  });
}

export type XLayerPublicClient = ReturnType<typeof publicClientFor>;

export function submitterAccount(env: Env): PrivateKeyAccount {
  if (!HEX_PRIVATE_KEY_RE.test(env.SUBMITTER_PRIVATE_KEY)) {
    throw new Error("SUBMITTER_PRIVATE_KEY is not a 32-byte hex private key");
  }
  return privateKeyToAccount(env.SUBMITTER_PRIVATE_KEY as `0x${string}`);
}

export function walletClientFor(env: Env) {
  return createWalletClient({
    account: submitterAccount(env),
    chain: xLayer,
    transport: fallback(rpcUrls(env).map((url) => http(url))),
  });
}
