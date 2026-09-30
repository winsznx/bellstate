import type { ChainDO } from "./durableObjects/chainDO.js";
import type { CoreDO } from "./durableObjects/coreDO.js";
import type { UsHaltsDO } from "./durableObjects/usHaltsDO.js";

export interface Env {
  US_HALTS: DurableObjectNamespace<UsHaltsDO>;
  CHAIN: DurableObjectNamespace<ChainDO>;
  CORE: DurableObjectNamespace<CoreDO>;

  /** Never logged or exposed on /health — only its derived address is. */
  SIGNER_PRIVATE_KEY: string;
  /** "0" | "20" | "40" — see src/scheduling/nextSlotAlarm.ts. */
  SIGNER_SLOT: string;
  /** Comma-separated URLs this signer POSTs signed attestations to. */
  AGGREGATOR_URLS: string;
  /** Comma-separated X Layer RPC URLs; the 2nd+ become viem fallback transports. */
  XLAYER_RPC_URLS: string;
  HUB_ADDRESS: string;

  /** Optional: set via `wrangler deploy --var BUILD_SHA:$(git rev-parse HEAD)` in CI. Reported on
   * /health per PRD §8.1; unset locally, so /health falls back to null rather than failing. */
  BUILD_SHA?: string;
}
