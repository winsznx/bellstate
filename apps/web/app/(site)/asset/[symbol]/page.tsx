import { AssetIcon } from "../../../_components/AssetIcon";
import type { Mic } from "@winsznx/bellstate-calendars";
import {
  formatVenueTime,
  marketSentence,
  PRIMARY_LEG_LABELS,
  PROGRAM_LIFECYCLE_LABELS,
  SESSION_LABELS,
  VALUATION_LABELS,
} from "@winsznx/bellstate-ui";
import { FacetCard } from "../../../_components/FacetCard";
import { loadAssetDetail, loadMarketHistory } from "./data";
import { loadOnchainStatus } from "../../lib/onchainStatus";

export const dynamic = "force-dynamic";
const address = (value: string | null) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
const time = (value: number, mic: Mic) =>
  value ? formatVenueTime(value, mic, false) : "—";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const [{ asset, error }, onchain, history] = await Promise.all([
    loadAssetDetail(symbol),
    symbol.toLowerCase() === "nvdax" ? loadOnchainStatus() : Promise.resolve(null),
    loadMarketHistory(symbol),
  ]);
  if (error || !asset)
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink">
          {error ? "Asset unavailable" : "Asset not found"}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {error ?? `No X Layer issuer asset was found for ${symbol}.`}
        </p>
      </main>
    );
  const mic = (asset.mic ?? "XNAS") as Mic;
  const freshness = (facet: "market" | "program" | "primary" | "valuation") =>
    asset.facets[facet]
      ? `Effective ${new Date(asset.facets[facet].effectiveAsOf).toLocaleString()}`
      : "No onchain status indexed";
  return (
    <main className="mx-auto max-w-[1200px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-wide text-ink-muted">
          {asset.issuer} · {asset.source === "indexed" ? "Indexed program" : "Issuer catalog"}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <AssetIcon symbol={asset.symbol} issuerLogo={asset.logo} size={48} />
          <h1 className="min-w-0 text-2xl font-semibold text-ink sm:text-3xl">
            {asset.symbol}{" "}
            <span className="block text-base font-normal text-ink-secondary sm:inline sm:text-lg">
              · {asset.name}
            </span>
          </h1>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          {[
            ["ISIN", asset.isin],
            ["Underlying ISIN", asset.underlyingIsin],
            ["Issuer trading hours", asset.tradingHoursMode],
            ["Reference venue", asset.venueName ?? asset.mic],
            ["Raw token", address(asset.rawTokenAddress)],
            ["Wrapped token", address(asset.wrapperAddress)],
            ["Raw adapter", address(asset.rawAdapterAddress)],
            ["Wrapped adapter", address(asset.wrapperAdapterAddress)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-muted">{label}</dt>
              <dd className="break-all font-mono text-xs text-ink">
                {value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
        <a href={`https://api.xstocks.fi/api/v2/public/assets/${encodeURIComponent(asset.symbol)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs text-ink-secondary underline underline-offset-2">View issuer record</a>
        {asset.source === "issuer catalog" && (
          <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-secondary">
            The issuer lists this token on X Layer. Bellstate has no public database record for it; a deployed adapter reading, when available, appears separately below.
          </p>
        )}
        {asset.source === "indexed" && !asset.programActive && <p className="mt-3 text-sm text-ink-secondary">This indexed program is inactive.</p>}
      </header>
      {onchain && <section aria-label="Onchain adapter status" className="mb-8 rounded-control border border-border bg-surface px-4 py-4 text-sm">
        <h2 className="font-semibold text-ink">Onchain adapter status</h2>
        <p className="mt-1 text-ink-secondary">{onchain.session} session · {onchain.interruption} interruption{onchain.stale ? " · stale" : ""}{onchain.transitionExpired ? " · transition expired" : ""}</p>
        <p className="mt-2 text-xs text-ink-muted">Read from X Layer block {onchain.blockNumber.toLocaleString()} at {new Date(onchain.blockTimestamp).toLocaleString()}. This is separate from the issuer catalog.</p>
      </section>}
      <section aria-label="Status" className="mb-8">
        <p className="mb-4 text-lg text-ink">
          {asset.market && asset.mic
            ? marketSentence({
                venue: asset.venueName ?? asset.mic,
                symbol: asset.symbol,
                mic,
                state: asset.market,
              })
            : "Market status is not in Bellstate’s public database for this asset."}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FacetCard
            title="Market"
            rows={
              asset.market
                ? [
                    {
                      label: "Session",
                      value: SESSION_LABELS[asset.market.session],
                    },
                    { label: "Interruption", value: asset.market.interruption },
                    {
                      label: "Since",
                      value: time(asset.market.sessionSince, mic),
                    },
                    {
                      label: "Next transition",
                      value: time(asset.market.nextScheduledTransition, mic),
                    },
                    { label: "Freshness", value: freshness("market") },
                  ]
                : []
            }
            notProvidedReason={
              asset.market ? undefined : "no onchain status indexed"
            }
          />
          <FacetCard
            title="Program"
            rows={
              asset.program
                ? [
                    {
                      label: "Lifecycle",
                      value: PROGRAM_LIFECYCLE_LABELS[asset.program.lifecycle],
                    },
                    {
                      label: "Program status",
                      value: asset.program.programStatus,
                    },
                    { label: "Reason", value: asset.program.programReason },
                    { label: "Freshness", value: freshness("program") },
                  ]
                : []
            }
            notProvidedReason={
              asset.program ? undefined : "no onchain status indexed"
            }
          />
          <FacetCard
            title="Primary"
            rows={
              asset.primary
                ? [
                    {
                      label: "Issuance",
                      value: PRIMARY_LEG_LABELS[asset.primary.issuance.state],
                    },
                    {
                      label: "Redemption",
                      value: PRIMARY_LEG_LABELS[asset.primary.redemption.state],
                    },
                    {
                      label: "Next change",
                      value: time(asset.primary.nextScheduledChange, mic),
                    },
                    { label: "Freshness", value: freshness("primary") },
                  ]
                : []
            }
            notProvidedReason={
              asset.primary ? undefined : "no onchain status indexed"
            }
          />
          <FacetCard
            title="Valuation"
            rows={
              asset.valuation
                ? [
                    {
                      label: "Condition",
                      value: VALUATION_LABELS[asset.valuation.condition],
                    },
                    {
                      label: "Source status",
                      value: asset.valuation.sourceMarketStatus,
                    },
                    { label: "Freshness", value: freshness("valuation") },
                  ]
                : []
            }
            notProvidedReason={
              asset.valuation ? undefined : "no valuation status indexed"
            }
          />
        </div>
      </section>
      <section aria-labelledby="history-heading" className="border-t border-border pt-6">
        <h2 id="history-heading" className="text-lg font-semibold text-ink">Onchain attestation history</h2>
        <p className="mt-1 text-sm text-ink-secondary">Past BellstateHub market updates on X Layer. These records show what was attested then; the current effective state is shown above and may now be unknown or stale.</p>
        {history.error ? <p role="alert" className="mt-4 text-sm text-ink-secondary">{history.error}</p> : history.items.length === 0 ? <p className="mt-4 text-sm text-ink-muted">No market attestations have been indexed for this asset.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[580px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-ink-muted"><th className="py-2 pr-4">Included onchain</th><th className="py-2 pr-4">Sequence</th><th className="py-2 pr-4">Attested session</th><th className="py-2 pr-4">Interruption</th><th className="py-2 pr-4">Evidence</th></tr></thead>
              <tbody>{history.items.map((item) => <tr key={item.id} className="border-b border-border">
                <td className="py-3 pr-4 text-ink-secondary">{new Date(item.includedAt ?? item.indexedAt).toLocaleString()}{!item.includedAt && <span className="block text-xs text-ink-muted">Indexed time</span>}</td>
                <td className="py-3 pr-4 font-mono text-xs">{item.seq}</td>
                <td className="py-3 pr-4">{SESSION_LABELS[item.session]}</td>
                <td className="py-3 pr-4">{item.interruption}</td>
                <td className="py-3 pr-4"><a href={`/event/${item.id}`} className="text-ink-secondary underline underline-offset-2">Event</a>{item.txHash && <a href={`https://www.oklink.com/xlayer/tx/${item.txHash}`} target="_blank" rel="noopener noreferrer" className="ml-3 text-ink-secondary underline underline-offset-2">Transaction</a>}</td>
              </tr>)}</tbody>
            </table>
            <p className="mt-3 text-xs text-ink-muted">Showing the latest {history.items.length} indexed market updates. Source: BellstateHub transaction logs.</p>
          </div>
        )}
      </section>
      <section className="mt-8 border-t border-border pt-6 text-sm text-ink-muted">
        Halt history, guards, pools, integration and subscriptions are not available on this page yet.
      </section>
    </main>
  );
}
