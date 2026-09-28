import Link from "next/link";
import { REPLAYS } from "./fixtures";

/** PRD §11.5 S08. */
export default function ReplaysPage() {
  const published = REPLAYS.filter((r) => r.published);
  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold text-ink">Replays</h1>
      <div className="space-y-4">
        {published.map((r) => (
          <Link
            key={r.slug}
            href={`/replay/${r.slug}`}
            className="block rounded-panel border border-border bg-surface p-4 hover:bg-surface-muted"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">{r.title}</h2>
              <span className="font-mono text-xs text-ink-muted">{r.date}</span>
            </div>
            <p className="mt-1 text-sm text-ink-secondary">{r.summary}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
              <span>{r.venues.join(" · ")}</span>
              <span>{r.keyFigure}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
