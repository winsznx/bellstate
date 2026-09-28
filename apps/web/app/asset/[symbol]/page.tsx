import { notFound } from "next/navigation";
import type { Mic } from "@winsznx/bellstate-calendars";
import {
  formatAddress,
  formatVenueTime,
  marketSentence,
  PRIMARY_LEG_LABELS,
  PROGRAM_LIFECYCLE_LABELS,
  SESSION_LABELS,
  VALUATION_LABELS,
} from "@winsznx/bellstate-ui";
import { FacetCard } from "../../_components/FacetCard";
import { SessionChip } from "../../_components/StatusChip";
import { getAssetDetail } from "./fixtures";

// PRD §11.5 S02. Identity + status hero + home market are built; timeline, halt history,
// valuation panel, guards panel, pools, integrate and subscribe regions all need a live
// adapter/indexer/pool-events source that doesn't exist yet (see apps/web/README.md) — noted
// inline rather than silently omitted.

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const asset = getAssetDetail(symbol);
  if (!asset) notFound();

  const mic = asset.mic as Mic;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      {/* Region 1: identity */}
      <header className="mb-6 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-wide text-ink-muted">{asset.issuer}</div>
        <h1 className="mt-1 text-3xl font-semibold text-ink">
          {asset.symbol} <span className="text-lg font-normal text-ink-secondary">· {asset.name}</span>
        </h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted">ISIN</dt>
            <dd className="font-mono text-xs text-ink">{asset.isin}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Underlying ISIN</dt>
            <dd className="font-mono text-xs text-ink">{asset.underlyingIsin}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Raw token</dt>
            <dd className="font-mono text-xs text-ink">{formatAddress(asset.rawTokenAddress)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Wrapped token</dt>
            <dd className="font-mono text-xs text-ink">{formatAddress(asset.wrapperAddress)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Raw adapter</dt>
            <dd className="font-mono text-xs text-ink">{formatAddress(asset.rawAdapterAddress)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Wrapped adapter</dt>
            <dd className="font-mono text-xs text-ink">{formatAddress(asset.wrapperAdapterAddress)}</dd>
          </div>
        </dl>
        {!asset.programActive ? (
          <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-secondary">
            No longer tracked since —
          </p>
        ) : null}
      </header>

      {/* Region 2: status hero */}
      <section aria-label="Status" className="mb-8">
        <p className="mb-4 text-lg text-ink">
          {marketSentence({ venue: asset.venueName, symbol: asset.symbol, mic, state: asset.market })}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FacetCard
            title="Market"
            rows={[
              { label: "Session", value: SESSION_LABELS[asset.market.session] },
              { label: "Interruption", value: asset.market.interruption },
              { label: "Since", value: formatVenueTime(asset.market.sessionSince, mic, false) },
              { label: "Next transition", value: formatVenueTime(asset.market.nextScheduledTransition, mic, false) },
            ]}
          />
          <FacetCard
            title="Program"
            rows={[
              { label: "Lifecycle", value: PROGRAM_LIFECYCLE_LABELS[asset.program.lifecycle] },
              { label: "Program status", value: asset.program.programStatus },
              { label: "Reason", value: asset.program.programReason },
            ]}
          />
          <FacetCard
            title="Primary"
            rows={[
              { label: "Issuance", value: PRIMARY_LEG_LABELS[asset.primary.issuance.state] },
              { label: "Redemption", value: PRIMARY_LEG_LABELS[asset.primary.redemption.state] },
              {
                label: "Next change",
                value: asset.primary.nextScheduledChange
                  ? formatVenueTime(asset.primary.nextScheduledChange, mic, false)
                  : "—",
              },
            ]}
          />
          {asset.valuation ? (
            <FacetCard
              title="Valuation"
              rows={[
                { label: "Condition", value: VALUATION_LABELS[asset.valuation.condition] },
                { label: "Source status", value: asset.valuation.sourceMarketStatus },
                { label: "Feed ID", value: formatAddress(asset.valuation.feedId) },
              ]}
            />
          ) : (
            <FacetCard title="Valuation" rows={[]} notProvidedReason="no designated valuation stream for this program" />
          )}
        </div>
      </section>

      {/* Region 3: home market (ADS programs only) */}
      {asset.homeMarkets ? (
        <section aria-label="Home market" className="mb-8 border-t border-border pt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Home market</h2>
          <div className="flex gap-4">
            {asset.homeMarkets.map((h) => (
              <div key={h.mic} className="flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm">
                <span className="font-mono text-xs text-ink-muted">{h.mic}</span>
                <SessionChip session={h.session} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-border pt-6 text-sm text-ink-muted">
        Timeline, halt history, guards panel, pools, integrate and subscribe regions need a live
        indexer/adapter and are not built yet.
      </section>
    </main>
  );
}
