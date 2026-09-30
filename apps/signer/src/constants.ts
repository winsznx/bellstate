import type { Mic } from "@winsznx/bellstate-calendars";

/** PRD §4.1/§4.2: "Every request sends User-Agent: Bellstate/1.0 (+<APP_URL>/method)." Same
 * real, deployed app URL apps/signer/scripts/submit-market-update.ts already used for its
 * mainnet-verified attestation. */
export const APP_URL = "https://bellstate.timjosh507.workers.dev";

/** X Layer mainnet, per deployments/xlayer-mainnet.json. */
export const HUB_CHAIN_ID = 196;

/** The one real registered listing this build attests: XNAS:NVDA (deployments/xlayer-mainnet.json
 * `assets.NVDAx.listingId`). See README.md for why the other six PRD §8.1 subjects are deferred. */
export const LISTING_ID = "0x598fc09e1497adeff415fd9bfd7d342d656b7ba862bc7da90dc6ca99bd1c0049" as const;
export const SYMBOL = "NVDA";
export const MIC: Mic = "XNAS";

/** PRD §4.1: "Each signer requests exactly once per 60 s, at +0 s, +20 s and +40 s past the
 * minute for signers A, B and C... Outside 04:00–20:00 ET on US trading days, each signer
 * requests once per 300 s." Staggered by SIGNER_SLOT via nextSlotAlarmMs. */
export const NASDAQ_POLL_PERIOD_TRADING_SECONDS = 60;
export const NASDAQ_POLL_PERIOD_OFF_HOURS_SECONDS = 300;

/** PRD §4.2: "Today's range (all pages) every 30 s during 04:00–20:00 ET on trading days, 300 s
 * otherwise." Decoupled from Nasdaq's cadence and NOT signer-slotted — every signer polls NYSE
 * independently on this flat cadence. */
export const NYSE_POLL_PERIOD_TRADING_SECONDS = 30;
export const NYSE_POLL_PERIOD_OFF_HOURS_SECONDS = 300;

/** Resumed halts older than this are dropped from UsHaltsDO's in-memory state so it doesn't grow
 * without bound across a trading day. Open halts are never pruned regardless of age. */
export const US_HALTS_PRUNE_MAX_AGE_SECONDS = 24 * 60 * 60;

/** PRD §8.1: Chain and Core both loop every 5 seconds. */
export const CHAIN_POLL_INTERVAL_MS = 5_000;
export const CORE_TICK_INTERVAL_MS = 5_000;

/** PRD §8.1 refusal rule: "its clock is > 5s off the latest block timestamp." */
export const MAX_CLOCK_SKEW_SECONDS = 5;
