"use client";

import { useState, type FormEvent } from "react";
import { evaluatePreview, PRESETS, type PreviewInput, type PreviewResult } from "./preview";

const FIELDS: { key: keyof PreviewInput; label: string }[] = [
  { key: "listing", label: "Listing" },
  { key: "timestamp", label: "Timestamp with UTC offset" },
  { key: "price", label: "Print price (₩)" },
  { key: "size", label: "Shares" },
  { key: "currency", label: "Currency" },
  { key: "prevClose", label: "Previous close (₩)" },
];
const FLAG_TEXT: Record<string, string> = {
  VENUE_CLOSED: "Venue closed by calendar.",
  VENUE_EXTENDED: "Nextrade was in extended trading.",
  VENUE_AUCTION: "Venue was in auction.",
  FIRST_MINUTE: "Print was within one minute of session open.",
  PRIMARY_NOT_TRADING: "Primary KRX listing was not in regular trading.",
  AT_LIMIT: "Price equals a calculated ±30% daily limit.",
  DEVIATION: "Price differs from previous close by at least 10%.",
  FUTURE_TS: "Timestamp is in the future.",
};

export default function PrintCheckPage() {
  const [input, setInput] = useState<PreviewInput>(PRESETS[0]!.input);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState("");
  function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { setResult(evaluatePreview(input)); setError(""); }
    catch (cause) { setResult(null); setError(cause instanceof Error ? cause.message : "Preview failed."); }
  }
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold text-ink">Print Check preview</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
        Test a Korean equity print against Bellstate&apos;s calendar and price rules. This free,
        offchain preview does not query historical halts, signed attestations, or the paid x402 API.
      </p>
      <div className="mt-7 flex flex-wrap gap-2" aria-label="Historical examples">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button"
            onClick={() => { setInput(preset.input); setResult(null); setError(""); }}
            className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={run} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="mb-1 block text-sm font-medium text-ink">{field.label}</label>
              <input id={field.key} value={input[field.key]}
                onChange={(event) => { setInput({ ...input, [field.key]: event.target.value }); setResult(null); }}
                autoComplete="off"
                className="w-full rounded-control border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" />
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" className="w-full rounded-control bg-surface-strong px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Run free preview
          </button>
        </form>
        <section aria-live="polite" className="min-w-0">
          {result ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-sm text-ink-secondary">Calendar and price verdict</p>
                <p className={`mt-1 text-3xl font-semibold ${result.verdict === "REJECT" ? "text-red-700" : "text-ink"}`}>{result.verdict}</p>
                <p className="mt-2 text-sm text-ink-secondary">Basis: calendar-only reconstruction, assuming no historical halt.</p>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-ink-muted">Nextrade</dt><dd className="font-medium text-ink">{result.venueSession}</dd></div>
                  <div><dt className="text-ink-muted">Primary KRX</dt><dd className="font-medium text-ink">{result.primarySession}</dd></div>
                  <div><dt className="text-ink-muted">Lower limit</dt><dd className="font-medium text-ink">₩{result.lower.toLocaleString()}</dd></div>
                  <div><dt className="text-ink-muted">Upper limit</dt><dd className="font-medium text-ink">₩{result.upper.toLocaleString()}</dd></div>
                  <div><dt className="text-ink-muted">Tick</dt><dd className="font-medium text-ink">₩{result.tick.toLocaleString()}</dd></div>
                  <div><dt className="text-ink-muted">Deviation</dt><dd className="font-medium text-ink">{result.deviationPct.toFixed(2)}%</dd></div>
                </dl>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="font-semibold text-ink">Why this verdict</h2>
                {result.flags.length ? <ul className="mt-3 space-y-2">{result.flags.map((flag) => <li key={flag} className="text-sm text-ink-secondary"><strong className="text-ink">{flag}</strong>: {FLAG_TEXT[flag]}</li>)}</ul> : <p className="mt-2 text-sm text-ink-secondary">No calendar or price flags.</p>}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-ink-secondary">
                <h2 className="font-semibold text-ink">Contract policy comparison</h2>
                <p className="mt-2">Shared PrintGuard policy: <strong className="text-ink">{result.policyVerdict}</strong>{result.policyFlags.length ? ` · ${result.policyFlags.join(", ")}` : ""}.</p>
                <p className="mt-2">This is a local computation, not an onchain call. It does not inspect the print price or daily limit.</p>
                <p className="mt-2">Calendar version {result.calendarVersion}. Venue session began {result.sessionStart}.</p>
              </div>
            </div>
          ) : <div className="rounded-2xl border border-dashed border-border p-6 text-sm leading-6 text-ink-secondary">Choose a historical example or enter a 2026 Nextrade SK hynix print, then run the preview.</div>}
        </section>
      </div>
      <p className="mt-7 max-w-3xl text-xs leading-5 text-ink-muted">
        Source: Bellstate PRD §10.3 and its 2026 KRX/Nextrade calendar tables. Historical halt data,
        signed history, market source queries, and payment settlement are not included. A production
        Print Check can return a different verdict when those facts are available.
      </p>
    </main>
  );
}
