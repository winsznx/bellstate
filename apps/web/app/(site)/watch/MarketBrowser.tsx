"use client";

import Image from "next/image";
import { useState } from "react";
import type { PublicMarket } from "./hyperliquid";

export type MarketRow = PublicMarket & {
  mapped: boolean;
  flag: string | null;
  icon: string | null;
};

const PAGE_SIZE = 20;
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function price(value: number | null): string {
  if (value === null) return "—";
  return value < 1 ? value.toLocaleString("en-US", { maximumFractionDigits: 6 }) : number.format(value);
}

function signed(value: number | null, digits = 2): string {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function MarketIcon({ symbol, src, size = 32 }: { symbol: string; src: string | null; size?: number }) {
  if (src) return <Image src={src} alt="" aria-hidden width={size} height={size} className="shrink-0 rounded-full border border-border object-cover" />;
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-ink-secondary" style={{ width: size, height: size }}>{symbol.slice(0, 2)}</span>;
}

export function MarketBrowser({ markets, mappingAvailable, flagsAvailable }: { markets: MarketRow[]; mappingAvailable: boolean; flagsAvailable: boolean }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "mapped">("all");
  const [page, setPage] = useState(1);
  const filtered = markets.filter((market) =>
    (scope === "all" || market.mapped) && market.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const mappedCount = markets.filter((market) => market.mapped).length;

  return <section aria-labelledby="markets-heading" className="mt-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id="markets-heading" className="text-xl font-semibold tracking-tight text-ink">Explore exchange markets</h2>
        <p className="mt-1 text-sm text-ink-secondary">Live public xyz perp quotes. These prices are indicative, not Bellstate signed status or valuation.</p>
      </div>
      <span className="text-sm tabular-nums text-ink-muted">{markets.length} markets · {mappingAvailable ? `${mappedCount} mapped` : "Mapping unavailable"}</span>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <label className="min-w-[220px] flex-1 sm:max-w-[360px]">
        <span className="sr-only">Search markets</span>
        <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search market, e.g. NVDA" className="w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-blue-600" />
      </label>
      <div role="group" aria-label="Market scope" className="inline-flex rounded-control border border-border p-1 text-sm">
        <button type="button" aria-pressed={scope === "all"} onClick={() => { setScope("all"); setPage(1); }} className={`rounded-control px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600 ${scope === "all" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"}`}>All markets</button>
        <button type="button" disabled={!mappingAvailable} aria-pressed={scope === "mapped"} onClick={() => { setScope("mapped"); setPage(1); }} className={`rounded-control px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 ${scope === "mapped" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"}`}>{mappingAvailable ? `Mapped (${mappedCount})` : "Mapping unavailable"}</button>
      </div>
    </div>
    <p role="status" className="mt-3 text-xs tabular-nums text-ink-muted">Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
    <div className="mt-3 overflow-x-auto rounded-panel border border-border bg-surface">
      <table className="w-full min-w-[770px] border-collapse text-left text-sm">
        <thead className="border-b border-border bg-canvas text-xs text-ink-muted"><tr><th scope="col" className="px-4 py-3 font-medium">Market</th><th scope="col" className="px-3 py-3 font-medium">Oracle</th><th scope="col" className="px-3 py-3 font-medium">Mark</th><th scope="col" className="px-3 py-3 font-medium">24h change</th><th scope="col" className="px-3 py-3 font-medium">Funding / hour</th><th scope="col" className="px-3 py-3 font-medium">24h volume</th><th scope="col" className="px-4 py-3 font-medium">Bellstate</th></tr></thead>
        <tbody>{rows.map((market) => {
          const symbol = market.name.slice(4);
          return <tr key={market.name} className="border-b border-border last:border-0 hover:bg-canvas/60">
            <th scope="row" className="px-4 py-2.5 font-medium text-ink"><span className="flex items-center gap-2.5"><MarketIcon symbol={symbol} src={market.icon} size={28} /><span>{symbol}<span className="ml-1 text-xs font-normal text-ink-muted">xyz</span></span></span></th>
            <td className="px-3 py-2.5 tabular-nums text-ink">{price(market.oracle)}</td>
            <td className="px-3 py-2.5 tabular-nums text-ink">{price(market.mark)}</td>
            <td className={`px-3 py-2.5 tabular-nums ${market.dayChange === null ? "text-ink-muted" : market.dayChange < 0 ? "text-red-700" : "text-emerald-700"}`}>{signed(market.dayChange)}</td>
            <td className="px-3 py-2.5 tabular-nums text-ink-secondary">{market.funding === null ? "—" : signed(market.funding * 100, 4)}</td>
            <td className="px-3 py-2.5 tabular-nums text-ink-secondary">{market.dayVolume === null ? "—" : compact.format(market.dayVolume)}</td>
            <td className="px-4 py-2.5 text-xs">{!mappingAvailable ? <span className="text-ink-muted">Mapping unavailable</span> : !flagsAvailable && market.mapped ? <span className="text-ink-muted">Flags unavailable</span> : market.flag ? <span className="font-semibold text-red-700">Flag: {market.flag}</span> : market.mapped ? <span className="font-medium text-ink">Mapped · no flag</span> : <span className="text-ink-muted">Exchange only</span>}</td>
          </tr>;
        })}</tbody>
      </table>
      {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-secondary">No markets match this search and filter.</p>}
    </div>
    {pageCount > 1 && <nav aria-label="Market pages" className="mt-4 flex items-center justify-end gap-3 text-sm">
      <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-control border border-border px-3 py-2 text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600">Previous</button>
      <span className="tabular-nums text-ink-secondary">Page {currentPage} of {pageCount}</span>
      <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-control border border-border px-3 py-2 text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600">Next</button>
    </nav>}
  </section>;
}
