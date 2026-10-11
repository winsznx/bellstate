import { AssetIcon } from "../../_components/AssetIcon";
import { supabaseServerClient } from "../lib/supabase";
import { loadPublicMarkets } from "./hyperliquid";

export const dynamic = "force-dynamic";

function price(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

function percent(value: number | null, digits = 2): string {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function volume(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

type RegisteredMarket = { dex: string; name: string; underlying_listing_ids: string[] | null };
type WatchFlag = { id: string; name: string; flag: string; window_start: string; move_pct: number | null };

export default async function WatchPage() {
  const db = supabaseServerClient();
  const [publicResult, marketsResult, flagsResult] = await Promise.all([
    loadPublicMarkets().then((data) => ({ data, error: null }), (error: unknown) => ({ data: null, error: error instanceof Error ? error.message : "Exchange feed unavailable" })),
    db ? db.from("perp_markets").select("dex,name,underlying_listing_ids").eq("dex", "xyz") : Promise.resolve(null),
    db ? db.from("oracle_watch_events").select("id,name,flag,window_start,move_pct").order("window_start", { ascending: false }).limit(20) : Promise.resolve(null),
  ]);
  const markets = publicResult.data?.markets ?? [];
  const registered = new Map(((marketsResult?.data ?? []) as RegisteredMarket[]).map((market) => [`${market.dex}:${market.name.replace(/^xyz:/, "")}`, market]));
  const flags = (flagsResult?.data ?? []) as WatchFlag[];
  const latestFlag = new Map<string, WatchFlag>();
  for (const flag of flags) if (!latestFlag.has(flag.name)) latestFlag.set(flag.name, flag);

  return (
    <main className="mx-auto w-full max-w-[1200px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Oracle Watch</h1>
        <p className="mt-2 max-w-[760px] text-sm leading-6 text-ink-secondary">Public xyz perp quotes from Hyperliquid, including equity and non-equity markets. Bellstate flags and reference-market mappings appear only when recorded by Watch.</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
          <span>{publicResult.data ? `${markets.length} exchange markets` : "Exchange feed unavailable"}</span>
          {publicResult.data && <span>Fetched {new Date(publicResult.data.fetchedAt).toLocaleString()}</span>}
          <a className="underline underline-offset-2 hover:text-ink" href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals" target="_blank" rel="noopener noreferrer">Hyperliquid data source ↗</a>
        </div>
      </header>

      {publicResult.error && <p role="alert" className="mt-6 rounded-panel border border-border p-4 text-sm text-ink-secondary">Live exchange quotes could not be loaded ({publicResult.error}). Refresh this page to retry.</p>}
      {marketsResult?.error && <p role="status" className="mt-4 text-sm text-ink-secondary">Bellstate market mappings could not be loaded.</p>}

      <section aria-labelledby="market-heading" className="mt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 id="market-heading" className="text-lg font-semibold text-ink">xyz markets</h2>
          <p className="text-xs text-ink-muted">Exchange prices are indicative and are not Bellstate signed status or valuation.</p>
        </div>
        {!publicResult.error && !markets.length && <p className="text-sm text-ink-secondary">The exchange did not return any xyz markets.</p>}
        {markets.length > 0 && <div className="overflow-x-auto rounded-panel border border-border bg-surface">
          <table className="min-w-[800px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-border bg-canvas text-xs text-ink-muted"><tr><th scope="col" className="px-4 py-3 font-medium">Market</th><th scope="col" className="px-3 py-3 font-medium">Oracle</th><th scope="col" className="px-3 py-3 font-medium">Mark</th><th scope="col" className="px-3 py-3 font-medium">Day change</th><th scope="col" className="px-3 py-3 font-medium">Funding / hour</th><th scope="col" className="px-3 py-3 font-medium">Day volume</th><th scope="col" className="px-4 py-3 font-medium">Bellstate Watch</th></tr></thead>
            <tbody>{markets.map((market) => {
              const mapped = registered.get(market.name);
              const flag = latestFlag.get(market.name) ?? latestFlag.get(market.name.slice(4));
              return <tr key={market.name} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 font-medium text-ink"><span className="flex items-center gap-2"><AssetIcon symbol={market.name.slice(4)} size={24} />{market.name}</span></th>
                <td className="px-3 py-3 tabular-nums">{price(market.oracle)}</td>
                <td className="px-3 py-3 tabular-nums">{price(market.mark)}</td>
                <td className="px-3 py-3 tabular-nums">{percent(market.dayChange)}</td>
                <td className="px-3 py-3 tabular-nums">{market.funding === null ? "—" : percent(market.funding * 100, 4)}</td>
                <td className="px-3 py-3 tabular-nums">{volume(market.dayVolume)}</td>
                <td className="px-4 py-3 text-xs text-ink-secondary">{flag ? `Flag: ${flag.flag}` : mapped ? "Mapped · no flag" : "Not mapped"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
      </section>

      <section aria-labelledby="flags-heading" className="mt-9 border-t border-border pt-6">
        <h2 id="flags-heading" className="text-lg font-semibold text-ink">Bellstate Watch flags</h2>
        {flagsResult?.error ? <p className="mt-2 text-sm text-ink-secondary">Recorded flags could not be loaded.</p> : flags.length === 0 ? <p className="mt-2 text-sm text-ink-secondary">No flags have been recorded. Exchange quotes alone do not trigger a Bellstate flag without a registered market and reference listing.</p> : <ol className="mt-4 space-y-2">{flags.map((flag) => <li key={flag.id} className="rounded-control border border-border p-3 text-sm"><strong>{flag.name}: {flag.flag}</strong><div className="mt-1 text-xs text-ink-muted">{new Date(flag.window_start).toLocaleString()}{flag.move_pct === null ? "" : ` · ${flag.move_pct}% move`}</div></li>)}</ol>}
      </section>
    </main>
  );
}
