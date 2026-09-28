import type { UnixSeconds, ValuationMarketView, ValuationReport, ValuationState } from "./types.js";

const REPORT_MAX_AGE_SECONDS = 60;
const STALENESS_THRESHOLD_SECONDS = 120;

/** PRD §3.6. */
export function deriveValuation(
  _programId: `0x${string}`,
  t: UnixSeconds,
  report: ValuationReport | null,
  market: ValuationMarketView,
): ValuationState {
  if (!report || report.fetchedSecondsAgo > REPORT_MAX_AGE_SECONDS) {
    return {
      condition: "UNKNOWN",
      valueAsOf: 0,
      nextExpectedUpdate: 0,
      conditionSince: 0,
      sourceMarketStatus: "UNKNOWN",
    };
  }

  if (market.interruption === "ASSET_HALTED" || market.interruption === "VENUE_HALTED") {
    return {
      condition: "EXPECTED_NO_UPDATE",
      valueAsOf: report.lastUpdateTimestamp,
      nextExpectedUpdate: market.expectedResumption,
      conditionSince: 0,
      sourceMarketStatus: report.marketStatus,
    };
  }

  if (report.marketStatus === "CLOSED") {
    return {
      condition: "EXPECTED_NO_UPDATE",
      valueAsOf: report.lastUpdateTimestamp,
      nextExpectedUpdate: 0,
      conditionSince: 0,
      sourceMarketStatus: report.marketStatus,
    };
  }

  if (report.marketStatus === "OPEN") {
    if (t - report.lastUpdateTimestamp > STALENESS_THRESHOLD_SECONDS) {
      return {
        condition: "DELAYED",
        valueAsOf: report.lastUpdateTimestamp,
        nextExpectedUpdate: 0,
        conditionSince: report.lastUpdateTimestamp + STALENESS_THRESHOLD_SECONDS,
        sourceMarketStatus: report.marketStatus,
      };
    }
    // valueAsOf is 0 while UPDATING: attesting a timestamp that moves every second would force an
    // onchain write per second (§3.6). Consumers read the timestamp inside the verified report.
    return {
      condition: "UPDATING",
      valueAsOf: 0,
      nextExpectedUpdate: 0,
      conditionSince: 0,
      sourceMarketStatus: report.marketStatus,
    };
  }

  return {
    condition: "UNKNOWN",
    valueAsOf: 0,
    nextExpectedUpdate: 0,
    conditionSince: 0,
    sourceMarketStatus: report.marketStatus,
  };
}
