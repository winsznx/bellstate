import type { XstocksAsset, XstocksOracle, XstocksPage } from "./types.js";

export function parseAssetsPage(json: string): XstocksPage<XstocksAsset> {
  return JSON.parse(json) as XstocksPage<XstocksAsset>;
}

export function parseAsset(json: string): XstocksAsset {
  return JSON.parse(json) as XstocksAsset;
}

export function parseOraclesPage(json: string): XstocksPage<XstocksOracle> {
  return JSON.parse(json) as XstocksPage<XstocksOracle>;
}
