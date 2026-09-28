import type { Lifecycle, MarketState } from "@winsznx/bellstate-engine";

/**
 * PRD §11.5 S01's real data source is a server snapshot of status_current joined across
 * programs/listings/tokens/pools plus Supabase Realtime — none of that exists yet (no deployed
 * hub, no Supabase project; see internal/NEEDS.md). This fixture stands in for that snapshot so
 * the Board's structure, states and flows (what §11.1 step 10 permits building without
 * reference images) can be built and reviewed now. Swap for a real server fetch once the
 * backend is deployed — nothing else on this page should need to change.
 */
export interface BoardRow {
  symbol: string;
  name: string;
  mic: string;
  venueName: string;
  market: MarketState;
  valuationCondition: "UPDATING" | "EXPECTED_NO_UPDATE" | "DELAYED" | "UNKNOWN" | "NOT_PROVIDED";
  primaryIssuance: "ACCEPTING" | "RESTRICTED" | "CLOSED" | "SUSPENDED" | "UNKNOWN";
  programLifecycle: Lifecycle;
  homeMarkets?: { mic: string; session: MarketState["session"] }[];
}

const NOW = Math.floor(Date.now() / 1000);

export const BOARD_ROWS: BoardRow[] = [
  {
    symbol: "NVDAx",
    name: "NVIDIA xStock",
    mic: "XNAS",
    venueName: "Nasdaq",
    market: {
      session: "REGULAR",
      interruption: "NONE",
      reasonCategory: "NONE",
      reasonCode: "NONE",
      sessionSince: NOW - 3600,
      nextScheduledTransition: NOW + 3600,
      interruptionSince: 0,
      expectedResumption: 0,
    },
    valuationCondition: "UPDATING",
    primaryIssuance: "ACCEPTING",
    programLifecycle: "ACTIVE",
  },
  {
    symbol: "CTNTx",
    name: "Cheetah Net Supply Chain xStock",
    mic: "XNAS",
    venueName: "Nasdaq",
    market: {
      session: "REGULAR",
      interruption: "ASSET_HALTED",
      reasonCategory: "NEWS",
      reasonCode: "T1",
      sessionSince: NOW - 3600,
      nextScheduledTransition: NOW + 3600,
      interruptionSince: NOW - 120,
      expectedResumption: 0,
    },
    valuationCondition: "EXPECTED_NO_UPDATE",
    primaryIssuance: "SUSPENDED",
    programLifecycle: "ACTIVE",
  },
  {
    symbol: "SKHYx",
    name: "SK hynix xStock",
    mic: "XKRX",
    venueName: "KRX",
    market: {
      session: "CLOSED",
      interruption: "NONE",
      reasonCategory: "NONE",
      reasonCode: "NONE",
      sessionSince: NOW - 1000,
      nextScheduledTransition: NOW + 30000,
      interruptionSince: 0,
      expectedResumption: 0,
    },
    valuationCondition: "NOT_PROVIDED",
    primaryIssuance: "RESTRICTED",
    programLifecycle: "ACTIVE",
    homeMarkets: [
      { mic: "XKRX", session: "CLOSED" },
      { mic: "NXTE", session: "EXTENDED" },
    ],
  },
  {
    symbol: "700x",
    name: "Tencent xStock",
    mic: "XHKG",
    venueName: "HKEX",
    market: {
      session: "UNKNOWN",
      interruption: "NONE",
      reasonCategory: "NONE",
      reasonCode: "NONE",
      sessionSince: NOW - 60,
      nextScheduledTransition: NOW + 60,
      interruptionSince: 0,
      expectedResumption: 0,
    },
    valuationCondition: "UNKNOWN",
    primaryIssuance: "ACCEPTING",
    programLifecycle: "ACTIVE",
  },
];
