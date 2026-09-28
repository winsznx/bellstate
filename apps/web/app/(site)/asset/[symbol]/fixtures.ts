import type { Lifecycle, MarketState, PrimaryState, ProgramState, ValuationState } from "@winsznx/bellstate-engine";

/** PRD §11.5 S02. Same fixture-not-live-backend situation as the Board (see
 * app/fixtures.ts) — this is what a joined adapter eth_call / status_current read would look
 * like once a hub is deployed. */
export interface AssetDetail {
  symbol: string;
  name: string;
  issuer: string;
  isin: string;
  underlyingIsin: string;
  mic: string;
  venueName: string;
  rawTokenAddress: `0x${string}`;
  wrapperAddress: `0x${string}`;
  rawAdapterAddress: `0x${string}`;
  wrapperAdapterAddress: `0x${string}`;
  programActive: boolean;
  market: MarketState;
  program: ProgramState;
  primary: PrimaryState;
  valuation: (ValuationState & { feedId: `0x${string}`; sourceId: `0x${string}` }) | null;
  homeMarkets?: { mic: string; venueName: string; session: MarketState["session"] }[];
}

const NOW = Math.floor(Date.now() / 1000);

const NVDAX: AssetDetail = {
  symbol: "NVDAx",
  name: "NVIDIA xStock",
  issuer: "Backed Finance",
  isin: "CH1436219195",
  underlyingIsin: "US67066G1040",
  mic: "XNAS",
  venueName: "Nasdaq",
  rawTokenAddress: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
  wrapperAddress: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
  rawAdapterAddress: "0x1111111111111111111111111111111111111a",
  wrapperAdapterAddress: "0x1111111111111111111111111111111111111b",
  programActive: true,
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
  program: { lifecycle: "ACTIVE" as Lifecycle, lifecycleOverride: null, programStatus: "NORMAL", programReason: "NONE" },
  primary: {
    issuance: { state: "ACCEPTING", reason: "NONE" },
    redemption: { state: "ACCEPTING", reason: "NONE" },
    nextScheduledChange: NOW + 3600,
    nextCutoff: 0,
  },
  valuation: {
    condition: "UPDATING",
    valueAsOf: 0,
    nextExpectedUpdate: 0,
    conditionSince: 0,
    sourceMarketStatus: "OPEN",
    feedId: "0x000a37a55df2ef907d8fa06af6632bc16da58a62b68be2e1994efaa037a0918a",
    sourceId: "0x1234567890123456789012345678901234567890123456789012345678901234",
  },
};

const SKHYX: AssetDetail = {
  symbol: "SKHYx",
  name: "SK hynix xStock",
  issuer: "Backed Finance",
  isin: "CH0000000000",
  underlyingIsin: "KR7000660001",
  mic: "XKRX",
  venueName: "KRX",
  rawTokenAddress: "0x2222222222222222222222222222222222222a",
  wrapperAddress: "0x2222222222222222222222222222222222222b",
  rawAdapterAddress: "0x2222222222222222222222222222222222222c",
  wrapperAdapterAddress: "0x2222222222222222222222222222222222222d",
  programActive: true,
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
  program: { lifecycle: "ACTIVE" as Lifecycle, lifecycleOverride: null, programStatus: "NORMAL", programReason: "NONE" },
  primary: {
    issuance: { state: "RESTRICTED", reason: "PERIOD_LIMITED" },
    redemption: { state: "RESTRICTED", reason: "PERIOD_LIMITED" },
    nextScheduledChange: NOW + 3600,
    nextCutoff: 0,
  },
  valuation: null,
  homeMarkets: [
    { mic: "XKRX", venueName: "KRX", session: "CLOSED" },
    { mic: "NXTE", venueName: "Nextrade", session: "EXTENDED" },
  ],
};

const FIXTURES: Record<string, AssetDetail> = {
  NVDAx: NVDAX,
  SKHYx: SKHYX,
};

export function getAssetDetail(symbol: string): AssetDetail | null {
  return FIXTURES[symbol] ?? null;
}
