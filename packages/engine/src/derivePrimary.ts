import type { PrimaryCatalogView, PrimaryLegState, PrimaryState, UnixSeconds } from "./types.js";

const CATALOG_MAX_AGE_SECONDS = 180;

function deriveLeg(catalog: PrimaryCatalogView, legEnabledByAnyStablecoin: boolean): PrimaryLegState {
  const trading = catalog.trading;
  if (!trading) {
    return { state: "UNKNOWN", reason: "NO_TRADING_OBJECT" };
  }
  if (trading.isTradingHalted) {
    return { state: "SUSPENDED", reason: "ISSUER_TRADING_HALTED" };
  }
  if (!legEnabledByAnyStablecoin) {
    return { state: "SUSPENDED", reason: "XLAYER_LEG_DISABLED" };
  }

  const period = trading.limitsPerPeriod[trading.currentPeriod];
  if (!period || period.max === 0) {
    return { state: "CLOSED", reason: "PERIOD_CLOSED" };
  }
  if (period.max < trading.limitsPerPeriod.market.max) {
    return { state: "RESTRICTED", reason: "PERIOD_LIMITED" };
  }
  return { state: "ACCEPTING", reason: "NONE" };
}

/** PRD §3.5. */
export function derivePrimary(_programId: `0x${string}`, _t: UnixSeconds, catalog: PrimaryCatalogView): PrimaryState {
  if (catalog.ageSeconds > CATALOG_MAX_AGE_SECONDS) {
    return {
      issuance: { state: "UNKNOWN", reason: "CATALOG_STALE" },
      redemption: { state: "UNKNOWN", reason: "CATALOG_STALE" },
      nextScheduledChange: 0,
      nextCutoff: 0,
    };
  }

  const issuance = deriveLeg(catalog, catalog.xlayer.issuanceEnabledByAnyStablecoin);
  const redemption = deriveLeg(catalog, catalog.xlayer.redemptionEnabledByAnyStablecoin);
  const nextScheduledChange = catalog.trading?.nextChangeAt ?? 0;

  return {
    issuance,
    redemption,
    nextScheduledChange,
    nextCutoff: 0,
  };
}
