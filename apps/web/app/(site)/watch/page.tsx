import Link from "next/link";
import watchIcons from "@/public/assets/watch/manifest.json";
import { supabaseServerClient } from "../lib/supabase";
import { loadPublicMarkets } from "./hyperliquid";
import { MarketBrowser, MarketIcon, type MarketRow } from "./MarketBrowser";

export const dynamic = "force-dynamic";

type RegisteredMarket = { dex: string; name: string; underlying_listing_ids: string[] | null };
type WatchFlag = { id: string; name: string; flag: string; window_start: string; move_pct: number | null };
const icons: Record<string, string> = watchIcons;

function quote(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
}

export default async function WatchPage() {
  const db = supabaseServerClient();
  const [publicResult, marketsResult, flagsResult] = await Promise.all([
    loadPublicMarkets().then((data) => ({ data, error: null }), (error: unknown) => ({ data: null, error: error instanceof Error ? error.message : "Exchange feed unavailable" })),
    db ? db.from("perp_markets").select("dex,name,underlying_listing_ids").eq("dex", "xyz") : Promise.resolve(null),
    db ? db.from("oracle_watch_events").select("id,name,flag,window_start,move_pct").order("window_start", { ascending: false }).limit(20) : Promise.resolve(null),
  ]);
  const mappingAvailable = Boolean(db && marketsResult && !marketsResult.error);
  const flagsAvailable = Boolean(db && flagsResult && !flagsResult.error);
  const registered = new Map(((marketsResult?.data ?? []) as RegisteredMarket[]).map((market) => [`${market.dex}:${market.name.replace(/^xyz:/, "")}`, market]));
  const flags = (flagsResult?.data ?? []) as WatchFlag[];
  const latestFlag = new Map<string, WatchFlag>();
  for (const flag of flags) if (!latestFlag.has(flag.name)) latestFlag.set(flag.name, flag);
  const markets: MarketRow[] = (publicResult.data?.markets ?? []).map((market) => ({
    ...market,
    mapped: mappingAvailable && registered.has(market.name),
    flag: flagsAvailable ? latestFlag.get(market.name)?.flag ?? latestFlag.get(market.name.slice(4))?.flag ?? null : null,
    icon: icons[market.name.slice(4)] ?? null,
  }));
  const mappedCount = markets.filter((market) => market.mapped).length;
  const nvda = markets.find((market) => market.name === "xyz:NVDA" && market.mapped);

  return <main className="mx-auto w-full max-w-[1200px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
    <header className="border-b border-border pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Oracle Watch</h1>
          <p className="mt-2 max-w-[680px] text-sm leading-6 text-ink-secondary">Compare public perp quotes with markets Bellstate has registered to watch.</p>
        </div>
        {publicResult.data && <div className="rounded-control border border-border bg-surface px-4 py-2 text-right">
          <strong className="block text-2xl tabular-nums leading-none text-ink">{mappingAvailable ? mappedCount : "—"}<span className="text-base font-normal text-ink-muted"> / {markets.length}</span></strong>
          <span className="mt-1 block text-xs text-ink-secondary">{mappingAvailable ? "exchange markets mapped" : "mapping unavailable"}</span>
        </div>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
        {publicResult.data && <span>Exchange feed fetched {new Date(publicResult.data.fetchedAt).toLocaleString()}</span>}
        <a className="underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600" href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals" target="_blank" rel="noopener noreferrer">Hyperliquid data source ↗</a>
        <span>Matched company artwork: xStocks issuer catalog; it identifies the underlying, not a Hyperliquid affiliation.</span>
      </div>
    </header>

    {publicResult.error && <p role="alert" className="mt-6 rounded-panel border border-border p-4 text-sm text-ink-secondary">Live exchange quotes could not be loaded ({publicResult.error}). Refresh this page to retry.</p>}
    {!publicResult.error && !markets.length && <p role="status" className="mt-6 text-sm text-ink-secondary">The exchange did not return any xyz markets.</p>}
    {marketsResult?.error && <p role="status" className="mt-4 text-sm text-ink-secondary">Bellstate market mappings could not be loaded. Mapping labels are unavailable.</p>}
    {!db && <p role="status" className="mt-4 text-sm text-ink-secondary">Bellstate market mappings are unavailable.</p>}

    {nvda && <section aria-labelledby="tracked-heading" className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tracked-heading" className="text-xl font-semibold tracking-tight text-ink">Tracked in Bellstate</h2>
        <p className="text-xs text-ink-muted">Registered market · public quote</p>
      </div>
      <div className="rounded-panel border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <MarketIcon symbol="NVDA" src={nvda.icon} size={48} />
            <div>
              <h3 className="text-xl font-semibold leading-tight text-ink">NVIDIA <span className="text-base font-normal text-ink-secondary">· xyz:NVDA</span></h3>
              <p className="mt-1 text-xs text-ink-muted">Hyperliquid perp market mapped to Bellstate’s NVDA reference listing</p>
            </div>
          </div>
          <Link href="/asset/NVDAx" className="rounded-control border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-blue-600">View Bellstate asset ↗</Link>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5 sm:grid-cols-4">
          <div><dt className="text-xs text-ink-muted">Oracle quote</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{quote(nvda.oracle)}</dd></div>
          <div><dt className="text-xs text-ink-muted">Mark quote</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{quote(nvda.mark)}</dd></div>
          <div><dt className="text-xs text-ink-muted">24h change</dt><dd className={`mt-1 text-xl font-semibold tabular-nums ${nvda.dayChange === null ? "text-ink-muted" : nvda.dayChange < 0 ? "text-red-700" : "text-emerald-700"}`}>{nvda.dayChange === null ? "—" : `${nvda.dayChange > 0 ? "+" : ""}${nvda.dayChange.toFixed(2)}%`}</dd></div>
          <div><dt className="text-xs text-ink-muted">Watch result</dt><dd className="mt-1 text-sm font-medium text-ink">{!flagsAvailable ? "Watch result unavailable" : nvda.flag ? `Recorded flag: ${nvda.flag}` : "No recorded flag"}</dd></div>
        </dl>
        <p className="mt-5 text-xs leading-5 text-ink-secondary">These are exchange quotes. Bellstate’s signed market status is shown separately on the asset page; a quote does not establish an open session or a valuation.</p>
      </div>
    </section>}

    {markets.length > 0 && <MarketBrowser markets={markets} mappingAvailable={mappingAvailable} flagsAvailable={flagsAvailable} />}

    <section aria-labelledby="flags-heading" className="mt-10 border-t border-border pt-6">
      <h2 id="flags-heading" className="text-lg font-semibold text-ink">Recorded Watch flags</h2>
      {!flagsAvailable ? <p className="mt-2 text-sm text-ink-secondary">Recorded flags could not be loaded.</p> : flags.length === 0 ? <p className="mt-2 text-sm text-ink-secondary">No flags have been recorded. Watch needs a registered market and a usable reference status before it can create one.</p> : <ol className="mt-4 divide-y divide-border rounded-panel border border-border">{flags.map((flag) => <li key={flag.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"><strong className="text-ink">{flag.name}: {flag.flag}</strong><span className="text-xs text-ink-muted">{new Date(flag.window_start).toLocaleString()}{flag.move_pct === null ? "" : ` · ${flag.move_pct}% move`}</span></li>)}</ol>}
    </section>
  </main>;
}
