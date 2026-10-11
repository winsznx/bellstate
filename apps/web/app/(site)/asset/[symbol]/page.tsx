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
import { loadAssetDetail } from "./data";

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
  const { asset, error } = await loadAssetDetail(symbol);
  if (error || !asset)
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink">
          {error ? "Asset unavailable" : "Asset not tracked"}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {error ?? `No registered program was found for ${symbol}.`}
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
          {asset.issuer}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <AssetIcon symbol={asset.symbol} size={48} />
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
        {!asset.programActive && (
          <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-secondary">
            This program is no longer tracked.
          </p>
        )}
      </header>
      <section aria-label="Status" className="mb-8">
        <p className="mb-4 text-lg text-ink">
          {asset.market && asset.mic
            ? marketSentence({
                venue: asset.venueName ?? asset.mic,
                symbol: asset.symbol,
                mic,
                state: asset.market,
              })
            : "Market status has not been indexed for this asset."}
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
      <section className="border-t border-border pt-6 text-sm text-ink-muted">
        Timeline, halt history, guards, pools, integration and subscriptions are
        not available on this page yet.
      </section>
    </main>
  );
}
