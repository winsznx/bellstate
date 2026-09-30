import type { Chain } from "viem";

/** Real X Layer mainnet config, matching the chain object used elsewhere in this repo
 * (scripts/gates, packages/contracts deploy script) — chain id 196, public RPC. */
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
