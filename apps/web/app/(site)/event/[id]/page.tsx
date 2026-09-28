import { notFound } from "next/navigation";
import type { MarketState } from "@winsznx/bellstate-engine";
import { formatAddress, formatDuration, INTERRUPTION_LABELS, marketSentence, SESSION_LABELS } from "@winsznx/bellstate-ui";
import type { Mic } from "@winsznx/bellstate-calendars";
import { getEventEvidence } from "./fixtures";

// PRD §11.5 S04. Header, before->after diff and the evidence region (EIP-712 message, real
// recovered signatures) are built; consequences (affected pools, HaltGate/LendingGuard results,
// stream divergence) need a live indexer/adapter and aren't built — noted inline.

const FIELD_LABELS: Record<keyof MarketState, string> = {
  session: "Session",
  interruption: "Interruption",
  reasonCategory: "Reason category",
  reasonCode: "Reason code",
  sessionSince: "Session since",
  nextScheduledTransition: "Next transition",
  interruptionSince: "Interruption since",
  expectedResumption: "Expected resumption",
};

function displayValue(field: keyof MarketState, value: MarketState[keyof MarketState]): string {
  if (field === "session") return SESSION_LABELS[value as MarketState["session"]];
  if (field === "interruption") return INTERRUPTION_LABELS[value as MarketState["interruption"]];
  return String(value);
}

function latencyStep(label: string, t: number | null, previous: number | null): { label: string; text: string } {
  if (t === null) return { label, text: "— (signer metadata not recorded)" };
  const duration = previous !== null ? ` (+${formatDuration(t - previous)})` : "";
  return { label, text: `${new Date(t * 1000).toISOString()}${duration}` };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventEvidence(id);
  if (!event) notFound();

  const changedFields = (Object.keys(FIELD_LABELS) as (keyof MarketState)[]).filter(
    (field) => event.before[field] !== event.after[field],
  );

  const waterfall = [
    latencyStep("Source observed", event.latency.tSource, null),
    latencyStep("First seen", event.latency.tFirstSeen, event.latency.tSource),
    latencyStep("Quorum reached", event.latency.tQuorum, event.latency.tFirstSeen),
    latencyStep("Submitted", event.latency.tSubmitted, event.latency.tQuorum),
    latencyStep("Included onchain", event.latency.tIncluded, event.latency.tSubmitted),
    latencyStep("Indexed", event.latency.tIndexed, event.latency.tIncluded),
  ];

  const shareUrl = `https://bellstate.app/event/${event.id}`;
  const shareText = marketSentence({ venue: event.venue, symbol: event.symbol, mic: event.mic as Mic, state: event.after });

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      {/* Region 1: header */}
      <header className="mb-6 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-wide text-ink-muted">
          {event.symbol} · {event.venue}
        </div>
        <p className="mt-2 text-xl text-ink">{shareText}</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-1 pr-4">Field</th>
              <th className="py-1 pr-4">Before</th>
              <th className="py-1 pr-4">After</th>
            </tr>
          </thead>
          <tbody>
            {changedFields.map((field) => (
              <tr key={field} className="border-t border-border">
                <td className="py-2 pr-4 text-ink-muted">{FIELD_LABELS[field]}</td>
                <td className="py-2 pr-4 text-ink-secondary">{displayValue(field, event.before[field])}</td>
                <td className="py-2 pr-4 font-medium text-ink">{displayValue(field, event.after[field])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </header>

      {/* Region 2: latency waterfall */}
      <section aria-label="Latency" className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Latency</h2>
        <ol className="space-y-1.5 text-sm">
          {waterfall.map((step) => (
            <li key={step.label} className="flex justify-between gap-4">
              <span className="text-ink-muted">{step.label}</span>
              <span className="font-mono text-xs text-ink-secondary">{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Region 3: evidence */}
      <section aria-label="Evidence" className="mb-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Evidence</h2>

        <div className="mb-4">
          <div className="text-xs text-ink-muted">EIP-712 digest</div>
          <div className="font-mono text-xs text-ink">{event.digest}</div>
        </div>

        <div className="mb-4">
          <div className="mb-1 text-xs text-ink-muted">Signatures (recovered signer)</div>
          <ul className="space-y-1">
            {event.signatures.map((sig) => (
              <li key={sig.signer} className="flex items-center gap-2 font-mono text-xs">
                <span className="rounded-control bg-preserve-soft px-1.5 py-0.5 text-preserve">✓ recovered</span>
                <span className="text-ink">{formatAddress(sig.signer)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-ink-muted">Transaction</div>
            <div className="font-mono text-xs text-ink">{formatAddress(event.txHash)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Block</div>
            <div className="font-mono text-xs text-ink">{event.blockNumber.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-ink-muted">Gas used</div>
            <div className="font-mono text-xs text-ink">{event.gasUsed.toLocaleString()}</div>
          </div>
        </div>
      </section>

      {/* Region 4: consequences — needs a live indexer/adapter, not built. */}
      <section aria-label="Consequences" className="mb-8 border-t border-border pt-6 text-sm text-ink-muted">
        Affected pools, HaltGate/LendingGuard results and stream divergence need a live
        indexer/adapter and aren&apos;t built yet.
      </section>

      {/* Region 5: share */}
      <section aria-label="Share" className="border-t border-border pt-6">
        <div className="flex gap-4 text-sm">
          <span className="font-mono text-xs text-ink-muted">{shareUrl}</span>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
            className="text-brand underline"
          >
            Share on X
          </a>
        </div>
      </section>
    </main>
  );
}
