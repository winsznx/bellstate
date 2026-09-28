import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exchangeToMic, UnmappedExchangeError } from "../src/exchangeMap.js";
import { parseAsset, parseAssetsPage, parseOraclesPage } from "../src/parse.js";
import { toPrimaryCatalogView, toProgramCatalogView } from "../src/toEngineViews.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
function fixture(name: string): string {
  return readFileSync(join(__dirname, "..", "fixtures", name), "utf-8");
}

// All fixtures captured live from https://api.xstocks.fi/api/v2 on 2026-09-28, no auth.

describe("parseAssetsPage", () => {
  it("parses a real paginated catalog page", () => {
    const page = parseAssetsPage(fixture("2026-09-28-assets-page.json"));
    expect(page.nodes.length).toBe(3);
    expect(page.page.currentPage).toBe(0);
    expect(typeof page.page.hasNextPage).toBe("boolean");
  });
});

describe("parseAsset — NVDAx", () => {
  const asset = parseAsset(fixture("2026-09-28-assets-nvdax.json"));

  it("finds the XLayer deployment with the documented raw/wrapped addresses", () => {
    const xlayer = asset.deployments.find((d) => d.network === "XLayer");
    expect(xlayer).toBeDefined();
    expect(xlayer!.address.toLowerCase()).toBe("0xc845b2894dbddd03858fd2d643b4ef725fe0849d");
    expect(xlayer!.wrapperAddressV2?.toLowerCase()).toBe("0xa8ddb5cd96b5222afe198316e9a57caa642850d5");
  });

  it("uses exchange.mic directly since it's present", () => {
    expect(exchangeToMic(asset.trading!.exchange)).toBe("XNAS");
  });

  it("toProgramCatalogView reports hasXLayerDeployment true", () => {
    const view = toProgramCatalogView(asset, 10);
    expect(view).toEqual({ ageSeconds: 10, hasXLayerDeployment: true });
  });

  it("toPrimaryCatalogView maps maxOrderFiatValue to the engine's `max` field", () => {
    const view = toPrimaryCatalogView(asset, 10);
    expect(view.trading).not.toBeNull();
    expect(view.trading!.limitsPerPeriod.market.max).toBe(100_000_000);
    expect(view.trading!.currentPeriod).toBe("market");
  });

  it("toPrimaryCatalogView reports both legs enabled via the XLayer stablecoins", () => {
    const view = toPrimaryCatalogView(asset, 10);
    expect(view.xlayer.issuanceEnabledByAnyStablecoin).toBe(true);
    expect(view.xlayer.redemptionEnabledByAnyStablecoin).toBe(true);
  });
});

describe("exchangeToMic", () => {
  it("falls back to the explicit name table when mic is absent", () => {
    expect(exchangeToMic({ mic: null, name: "HKEX" })).toBe("XHKG");
  });

  it("throws (blocking registration) for an unmapped exchange name, per §4.5", () => {
    expect(() => exchangeToMic({ mic: null, name: "Some New Exchange" })).toThrow(UnmappedExchangeError);
  });
});

describe("parseOraclesPage — NVDAx XLayer feed", () => {
  it("matches the PRD's documented feed ID and verifier for NVDAx (§3.6)", () => {
    const page = parseOraclesPage(fixture("2026-09-28-oracles-nvdax.json"));
    const xlayerFeed = page.nodes.find((n) => n.network === "XLayer" && n.managedBy === "Chainlink");
    expect(xlayerFeed).toBeDefined();
    expect(xlayerFeed!.metadata.feedId).toBe(
      "0x000a37a55df2ef907d8fa06af6632bc16da58a62b68be2e1994efaa037a0918a",
    );
    expect(xlayerFeed!.metadata.verifierContract).toBe("0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7");
    expect(xlayerFeed!.metadata.reportSchema).toBe("v10");
  });

  it("also returns non-Chainlink feeds on other networks (Pyth on Polygon/Arbitrum/etc) that must be filtered out", () => {
    const page = parseOraclesPage(fixture("2026-09-28-oracles-nvdax.json"));
    const pythFeeds = page.nodes.filter((n) => n.managedBy === "Pyth");
    expect(pythFeeds.length).toBeGreaterThan(0);
  });
});
