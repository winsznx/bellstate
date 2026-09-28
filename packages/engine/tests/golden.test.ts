import { describe, expect, it } from "vitest";
import { deriveMarket } from "../src/deriveMarket.js";
import { deriveProgram } from "../src/deriveProgram.js";
import { derivePrimary } from "../src/derivePrimary.js";
import { deriveValuation } from "../src/deriveValuation.js";
import type { Listing, PrimaryCatalogView, ValuationMarketView, ValuationReport } from "../src/types.js";

const NVDA: Listing = {
  listingId: `0x${"11".repeat(32)}` as `0x${string}`,
  mic: "XNAS",
  symbol: "NVDA",
  aliases: [],
};

const PROGRAM_ID = `0x${"22".repeat(32)}` as const;

/** PRD §3.8 rows: joint readings Bellstate must emit for canonical real-world states. */
describe("deriveMarket — §3.8 canonical joint readings", () => {
  it("US stock, Saturday: CLOSED, NONE", () => {
    const t = 1_700_000_000;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: true,
      sessionWindow: { session: "CLOSED", sessionSince: t - 3600, nextScheduledTransition: t + 3600 },
      halts: [],
    });
    expect(result.session).toBe("CLOSED");
    expect(result.interruption).toBe("NONE");
    expect(result.reasonCategory).toBe("NONE");
    expect(result.expectedResumption).toBe(0);
  });

  it("Nasdaq pre-market 07:00 ET: EXTENDED, NONE", () => {
    const t = 1_700_000_000;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: true,
      sessionWindow: { session: "EXTENDED", sessionSince: t - 1800, nextScheduledTransition: t + 900 },
      halts: [],
    });
    expect(result.session).toBe("EXTENDED");
    expect(result.interruption).toBe("NONE");
  });

  it("US news halt (T1) at 11:02 ET: REGULAR, ASSET_HALTED(NEWS, T1)", () => {
    const t = 1_700_000_000;
    const haltAt = t - 120;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: true,
      sessionWindow: { session: "REGULAR", sessionSince: t - 5000, nextScheduledTransition: t + 5000 },
      halts: [{ scope: "ASSET", haltAt, resumeTradeAt: null, reasonCategory: "NEWS", reasonCode: "T1" }],
    });
    expect(result.session).toBe("REGULAR");
    expect(result.interruption).toBe("ASSET_HALTED");
    expect(result.reasonCategory).toBe("NEWS");
    expect(result.reasonCode).toBe("T1");
    expect(result.interruptionSince).toBe(haltAt);
    expect(result.expectedResumption).toBe(0);
  });

  it("LULD pause: expectedResumption comes from the feed, never estimated", () => {
    const t = 1_700_000_000;
    const haltAt = t - 30;
    const resumeTradeAt = t + 300;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: true,
      sessionWindow: { session: "REGULAR", sessionSince: t - 5000, nextScheduledTransition: t + 5000 },
      halts: [{ scope: "ASSET", haltAt, resumeTradeAt, reasonCategory: "VOLATILITY", reasonCode: "LUDP" }],
    });
    expect(result.interruption).toBe("ASSET_HALTED");
    expect(result.expectedResumption).toBe(resumeTradeAt);
  });

  it("MWCB level 1: REGULAR, VENUE_HALTED(MARKET_WIDE, MWC1) — venue beats any asset halt", () => {
    const t = 1_700_000_000;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: true,
      sessionWindow: { session: "REGULAR", sessionSince: t - 5000, nextScheduledTransition: t + 5000 },
      halts: [
        { scope: "ASSET", haltAt: t - 500, resumeTradeAt: null, reasonCategory: "NEWS", reasonCode: "T1" },
        { scope: "VENUE", haltAt: t - 10, resumeTradeAt: null, reasonCategory: "MARKET_WIDE", reasonCode: "MWC1" },
      ],
    });
    expect(result.interruption).toBe("VENUE_HALTED");
    expect(result.reasonCode).toBe("MWC1");
  });

  it("HKEX 16:09 random close window: UNKNOWN session, next transition 16:10", () => {
    const t = 1_700_000_000;
    const windowStart = t - 60;
    const windowEnd = t + 60;
    const result = deriveMarket(
      { ...NVDA, mic: "XHKG", symbol: "00700" },
      t,
      {
        sourceHealthy: true,
        sessionWindow: { session: "UNKNOWN", sessionSince: windowStart, nextScheduledTransition: windowEnd },
        halts: [],
      },
    );
    expect(result.session).toBe("UNKNOWN");
    expect(result.sessionSince).toBe(windowStart);
    expect(result.nextScheduledTransition).toBe(windowEnd);
    expect(result.interruption).toBe("NONE");
  });

  it("halt source down 5 min during US hours: REGULAR session, UNKNOWN(SOURCE_STALE) interruption", () => {
    const t = 1_700_000_000;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: false,
      sessionWindow: { session: "REGULAR", sessionSince: t - 5000, nextScheduledTransition: t + 5000 },
      halts: [],
    });
    expect(result.session).toBe("REGULAR");
    expect(result.interruption).toBe("UNKNOWN");
    expect(result.interruptionSince).toBe(0);
  });

  it("halt carries across closures: still ASSET_HALTED through the night's CLOSED session", () => {
    const haltAt = 1_700_000_000 - 4 * 3600;
    const t = 1_700_000_000;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: true,
      sessionWindow: { session: "CLOSED", sessionSince: t - 1000, nextScheduledTransition: t + 30000 },
      halts: [{ scope: "ASSET", haltAt, resumeTradeAt: null, reasonCategory: "NEWS", reasonCode: "T1" }],
    });
    expect(result.interruption).toBe("ASSET_HALTED");
    expect(result.interruptionSince).toBe(haltAt);
  });

  it("interruptionSince on NONE takes the latest past resumeTradeAt in the source window, else 0", () => {
    const t = 1_700_000_000;
    const resumedAt = t - 200;
    const result = deriveMarket(NVDA, t, {
      sourceHealthy: true,
      sessionWindow: { session: "REGULAR", sessionSince: t - 5000, nextScheduledTransition: t + 5000 },
      halts: [
        { scope: "ASSET", haltAt: t - 900, resumeTradeAt: resumedAt, reasonCategory: "NEWS", reasonCode: "T1" },
      ],
    });
    expect(result.interruption).toBe("NONE");
    expect(result.interruptionSince).toBe(resumedAt);
  });

  it("is deterministic: identical inputs produce a deep-equal result (§3.9)", () => {
    const t = 1_700_000_000;
    const snapshot = {
      sourceHealthy: true,
      sessionWindow: { session: "REGULAR" as const, sessionSince: t - 5000, nextScheduledTransition: t + 5000 },
      halts: [{ scope: "ASSET" as const, haltAt: t - 120, resumeTradeAt: null, reasonCategory: "NEWS" as const, reasonCode: "T1" }],
    };
    expect(deriveMarket(NVDA, t, snapshot)).toEqual(deriveMarket(NVDA, t, snapshot));
  });
});

describe("deriveProgram — §3.4", () => {
  it("ACTIVE/NORMAL: fresh catalog, both tokens have code, registered, not paused", () => {
    const result = deriveProgram(PROGRAM_ID, 1_700_000_000, {
      override: null,
      catalog: { ageSeconds: 3600, hasXLayerDeployment: true },
      bothTokensHaveCode: true,
      registeredInHub: true,
      pause: { rawPaused: false, wrappedPaused: false },
    });
    expect(result.lifecycle).toBe("ACTIVE");
    expect(result.programStatus).toBe("NORMAL");
    expect(result.programReason).toBe("NONE");
  });

  it("issuer pauses the wrapper: lifecycle stays ACTIVE, programStatus SUSPENDED", () => {
    const result = deriveProgram(PROGRAM_ID, 1_700_000_000, {
      override: null,
      catalog: { ageSeconds: 3600, hasXLayerDeployment: true },
      bothTokensHaveCode: true,
      registeredInHub: true,
      pause: { rawPaused: false, wrappedPaused: true },
    });
    expect(result.lifecycle).toBe("ACTIVE");
    expect(result.programStatus).toBe("SUSPENDED");
    expect(result.programReason).toBe("ISSUER_PAUSED");
  });

  it("owner override wins for lifecycle but programStatus is still read independently", () => {
    const result = deriveProgram(PROGRAM_ID, 1_700_000_000, {
      override: { lifecycle: "TERMINATED", evidenceHash: `0x${"aa".repeat(32)}` },
      catalog: { ageSeconds: 3600, hasXLayerDeployment: true },
      bothTokensHaveCode: true,
      registeredInHub: true,
      pause: { rawPaused: false, wrappedPaused: false },
    });
    expect(result.lifecycle).toBe("TERMINATED");
    expect(result.programStatus).toBe("NORMAL");
  });

  it("stale catalog (> 24h): lifecycle UNKNOWN", () => {
    const result = deriveProgram(PROGRAM_ID, 1_700_000_000, {
      override: null,
      catalog: { ageSeconds: 25 * 3600, hasXLayerDeployment: true },
      bothTokensHaveCode: true,
      registeredInHub: true,
      pause: { rawPaused: false, wrappedPaused: false },
    });
    expect(result.lifecycle).toBe("UNKNOWN");
  });

  it("token read failure: programStatus UNKNOWN regardless of lifecycle", () => {
    const result = deriveProgram(PROGRAM_ID, 1_700_000_000, {
      override: null,
      catalog: { ageSeconds: 3600, hasXLayerDeployment: true },
      bothTokensHaveCode: true,
      registeredInHub: true,
      pause: { rawPaused: null, wrappedPaused: false },
    });
    expect(result.programStatus).toBe("UNKNOWN");
    expect(result.programReason).toBe("TOKEN_READ_FAILED");
  });
});

describe("derivePrimary — §3.5", () => {
  const baseTrading = {
    isTradingHalted: false,
    nextChangeAt: 1_700_003_600,
    currentPeriod: "market",
    limitsPerPeriod: { market: { max: 10_000_000 }, overnight: { max: 1_000_000 } },
  };

  function catalog(overrides: Partial<PrimaryCatalogView["trading"]> = {}): PrimaryCatalogView {
    return {
      ageSeconds: 10,
      trading: {
        ...baseTrading,
        limitsPerPeriod: { ...baseTrading.limitsPerPeriod },
        ...overrides,
      },
      xlayer: { issuanceEnabledByAnyStablecoin: true, redemptionEnabledByAnyStablecoin: true },
    };
  }

  it("ACCEPTING/ACCEPTING during market hours", () => {
    const result = derivePrimary(PROGRAM_ID, 1_700_000_000, catalog());
    expect(result.issuance.state).toBe("ACCEPTING");
    expect(result.redemption.state).toBe("ACCEPTING");
    expect(result.nextScheduledChange).toBe(1_700_003_600);
    expect(result.nextCutoff).toBe(0);
  });

  it("RESTRICTED overnight: period max below market max", () => {
    const result = derivePrimary(
      PROGRAM_ID,
      1_700_000_000,
      catalog({ currentPeriod: "overnight" }),
    );
    expect(result.issuance.state).toBe("RESTRICTED");
    expect(result.issuance.reason).toBe("PERIOD_LIMITED");
  });

  it("CLOSED: period max is zero", () => {
    const c = catalog();
    c.trading!.limitsPerPeriod.market = { max: 0 };
    const result = derivePrimary(PROGRAM_ID, 1_700_000_000, c);
    expect(result.issuance.state).toBe("CLOSED");
    expect(result.issuance.reason).toBe("PERIOD_CLOSED");
  });

  it("issuer flags trading halted: SUSPENDED both legs", () => {
    const result = derivePrimary(PROGRAM_ID, 1_700_000_000, catalog({ isTradingHalted: true }));
    expect(result.issuance.state).toBe("SUSPENDED");
    expect(result.issuance.reason).toBe("ISSUER_TRADING_HALTED");
    expect(result.redemption.state).toBe("SUSPENDED");
  });

  it("no trading object: UNKNOWN, NO_TRADING_OBJECT", () => {
    const result = derivePrimary(PROGRAM_ID, 1_700_000_000, {
      ageSeconds: 10,
      trading: null,
      xlayer: { issuanceEnabledByAnyStablecoin: true, redemptionEnabledByAnyStablecoin: true },
    });
    expect(result.issuance.state).toBe("UNKNOWN");
    expect(result.issuance.reason).toBe("NO_TRADING_OBJECT");
  });

  it("stale catalog (> 180s): both legs UNKNOWN", () => {
    const c = catalog();
    c.ageSeconds = 181;
    const result = derivePrimary(PROGRAM_ID, 1_700_000_000, c);
    expect(result.issuance.state).toBe("UNKNOWN");
    expect(result.redemption.state).toBe("UNKNOWN");
    expect(result.issuance.reason).toBe("CATALOG_STALE");
  });
});

describe("deriveValuation — §3.6", () => {
  const OPEN_MARKET: ValuationMarketView = { interruption: "NONE", expectedResumption: 0 };

  it("UPDATING: fresh report, market open — valueAsOf is 0 by design", () => {
    const t = 1_700_000_000;
    const report: ValuationReport = { fetchedSecondsAgo: 5, lastUpdateTimestamp: t - 10, marketStatus: "OPEN" };
    const result = deriveValuation(PROGRAM_ID, t, report, OPEN_MARKET);
    expect(result.condition).toBe("UPDATING");
    expect(result.valueAsOf).toBe(0);
  });

  it("no report fetched within 60s: UNKNOWN", () => {
    const t = 1_700_000_000;
    const report: ValuationReport = { fetchedSecondsAgo: 61, lastUpdateTimestamp: t - 10, marketStatus: "OPEN" };
    const result = deriveValuation(PROGRAM_ID, t, report, OPEN_MARKET);
    expect(result.condition).toBe("UNKNOWN");
    expect(result.sourceMarketStatus).toBe("UNKNOWN");
  });

  it("reference market ASSET_HALTED: EXPECTED_NO_UPDATE, nextExpectedUpdate = market.expectedResumption", () => {
    const t = 1_700_000_000;
    const report: ValuationReport = { fetchedSecondsAgo: 5, lastUpdateTimestamp: t - 500, marketStatus: "OPEN" };
    const market: ValuationMarketView = { interruption: "ASSET_HALTED", expectedResumption: t + 300 };
    const result = deriveValuation(PROGRAM_ID, t, report, market);
    expect(result.condition).toBe("EXPECTED_NO_UPDATE");
    expect(result.valueAsOf).toBe(t - 500);
    expect(result.nextExpectedUpdate).toBe(t + 300);
  });

  it("report market closed: EXPECTED_NO_UPDATE, nextExpectedUpdate 0", () => {
    const t = 1_700_000_000;
    const report: ValuationReport = { fetchedSecondsAgo: 5, lastUpdateTimestamp: t - 500, marketStatus: "CLOSED" };
    const result = deriveValuation(PROGRAM_ID, t, report, OPEN_MARKET);
    expect(result.condition).toBe("EXPECTED_NO_UPDATE");
    expect(result.nextExpectedUpdate).toBe(0);
  });

  it("market open but stale > 120s: DELAYED with conditionSince = lastUpdateTimestamp + 120", () => {
    const t = 1_700_000_000;
    const lastUpdate = t - 200;
    const report: ValuationReport = { fetchedSecondsAgo: 5, lastUpdateTimestamp: lastUpdate, marketStatus: "OPEN" };
    const result = deriveValuation(PROGRAM_ID, t, report, OPEN_MARKET);
    expect(result.condition).toBe("DELAYED");
    expect(result.conditionSince).toBe(lastUpdate + 120);
  });
});
