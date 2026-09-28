// PRD §11.5 S15. "Rendered from live config" — no live config source exists yet (calendar
// versions, provisional rows, known limitations are meant to come from packages/calendars and
// ops state at runtime); this renders the same content as static data for now, structured so a
// future live-config read can replace the OBSERVABILITY/LIMITATIONS constants below without
// touching the page structure.

const OBSERVABILITY: { state: string; us: string; hk: string; kr: string }[] = [
  { state: "Scheduled session", us: "Yes", hk: "Yes", kr: "Yes" },
  {
    state: "Single-stock halt",
    us: "Yes (news, regulatory, LULD pause, operational)",
    hk: "Yes (from announcements)",
    kr: "Yes (disclosure halts, gate G2)",
  },
  { state: "Market-wide halt", us: "Yes (MWCB)", hk: "n/a (no market-wide breaker)", kr: "Gate G3" },
  {
    state: "Price-limit lock / LULD limit state / VI / VCM",
    us: "No free source. Not reported.",
    hk: "No (VCM)",
    kr: "No (VI, limit lock)",
  },
  { state: "Issuer program pause", us: "Yes (onchain isPaused)", hk: "Yes", kr: "Yes" },
  { state: "Primary mint/redeem window", us: "Yes (issuer API)", hk: "Yes", kr: "Yes" },
  {
    state: "Designated valuation stream condition",
    us: "Yes, for assets with a designated Chainlink stream on X Layer (gate G1)",
    hk: "No stream designated → interface not advertised",
    kr: "Same",
  },
];

const LIMITATIONS = [
  "Public-feed latency: Bellstate observes halts and resumptions only as fast as each venue's public feed publishes them.",
  "Unobservable states: no free source reports price-limit locks, LULD limit state, VI or VCM for any of the three markets (§2.3).",
  "HK resumption times: HKEX publishes no exact resumption time; Bellstate uses the next scheduled session start instead (§4.3).",
  "KR data access: KIND's actual halt/resumption event data lives behind an undocumented endpoint not yet integrated (gate G2) — KR halts currently report UNKNOWN (SOURCE_STALE).",
];

const SOURCES = [
  { name: "Nasdaq Trade Halt RSS", url: "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts" },
  { name: "NYSE trade halts JSON", url: "https://www.nyse.com/api/trade-halts/historical/filter" },
  { name: "HKEXnews predefined documents", url: "https://www1.hkexnews.hk/search/predefineddoc.xhtml?predefineddocuments=9" },
  { name: "xStocks public API", url: "https://api.xstocks.fi/api/v2" },
  { name: "Chainlink Data Streams", url: "https://api.dataengine.chain.link" },
];

export default function MethodPage() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="mb-2 text-3xl font-semibold text-ink">Methodology and coverage</h1>
      <p className="mb-8 text-sm text-ink-secondary">
        What Bellstate can and cannot observe, where the data comes from, and what's still
        provisional.
      </p>

      <section aria-label="Observability matrix" className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          What each venue feed can and cannot observe
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">US</th>
              <th className="py-2 pr-4">HK</th>
              <th className="py-2 pr-4">KR</th>
            </tr>
          </thead>
          <tbody>
            {OBSERVABILITY.map((row) => (
              <tr key={row.state} className="border-b border-border">
                <td className="py-2 pr-4 font-medium text-ink">{row.state}</td>
                <td className="py-2 pr-4 text-ink-secondary">{row.us}</td>
                <td className="py-2 pr-4 text-ink-secondary">{row.hk}</td>
                <td className="py-2 pr-4 text-ink-secondary">{row.kr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Known limitations" className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Known limitations</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-secondary">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Sources" className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Sources</h2>
        <ul className="space-y-1 text-sm">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <span className="text-ink">{s.name}</span>{" "}
              <a href={s.url} className="text-xs text-brand underline">
                {s.url}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Calendar versions" className="text-sm text-ink-muted">
        Calendar versions and provisional rows need a live calendar-release source — not built
        yet (packages/calendars is pinned to a single CALENDAR_VERSION locally; see its README).
      </section>
    </main>
  );
}
