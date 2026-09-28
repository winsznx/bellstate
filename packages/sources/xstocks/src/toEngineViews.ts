import type { PrimaryCatalogView, ProgramCatalogView } from "@winsznx/bellstate-engine";
import type { XstocksAsset } from "./types.js";

function isoToUnix(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor(Date.parse(iso) / 1000);
}

export function toProgramCatalogView(asset: XstocksAsset, ageSeconds: number): ProgramCatalogView {
  return {
    ageSeconds,
    hasXLayerDeployment: asset.deployments.some((d) => d.network === "XLayer"),
  };
}

/** Converts a real xStocks asset (fixtures/) into the engine's PrimaryCatalogView shape,
 * renaming minOrderFiatValue/maxOrderFiatValue -> max (packages/engine/src/types.ts's
 * PeriodLimit) since the engine's interface is source-agnostic. */
export function toPrimaryCatalogView(asset: XstocksAsset, ageSeconds: number): PrimaryCatalogView {
  const xlayerDeployment = asset.deployments.find((d) => d.network === "XLayer") ?? null;

  const trading = asset.trading;
  let mappedTrading: NonNullable<PrimaryCatalogView["trading"]> | null = null;
  if (trading) {
    const market = trading.limitsPerPeriod["market"];
    if (!market) {
      throw new Error(`xStocks asset ${asset.symbol} has no "market" entry in limitsPerPeriod`);
    }
    const limitsPerPeriod: Record<string, { max: number }> = {};
    for (const [period, limit] of Object.entries(trading.limitsPerPeriod)) {
      limitsPerPeriod[period] = { max: limit.maxOrderFiatValue };
    }
    mappedTrading = {
      isTradingHalted: trading.isTradingHalted,
      nextChangeAt: isoToUnix(trading.nextChangeAt),
      currentPeriod: trading.currentPeriod,
      limitsPerPeriod: { ...limitsPerPeriod, market: { max: market.maxOrderFiatValue } },
    };
  }

  return {
    ageSeconds,
    trading: mappedTrading,
    xlayer: {
      issuanceEnabledByAnyStablecoin: xlayerDeployment?.stablecoins.some((s) => s.issuance) ?? false,
      redemptionEnabledByAnyStablecoin: xlayerDeployment?.stablecoins.some((s) => s.redemption) ?? false,
    },
  };
}
