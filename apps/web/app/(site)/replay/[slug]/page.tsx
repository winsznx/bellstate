import { notFound } from "next/navigation";
import { resolveSessionWindow, type Mic } from "@winsznx/bellstate-calendars";
import { SESSION_LABELS } from "@winsznx/bellstate-ui";
import { getReplay } from "../fixtures";

// PRD §11.5 S09. The venue panel is computed *live* from packages/calendars at the replay's own
// timestamp (genuinely real for the two published incidents, both real historical dates) — the
// scrubber, print/perp/guards panels, sources drawer and conflicts box need a real incident data
// pipeline (candle history, print records, PolicyLens replay runs) that doesn't exist yet.

const REPLAY_START_UNIX: Record<string, number> = {
  "jul-28-skhynix": Date.UTC(2026, 6, 27, 23, 0, 0) / 1000, // Jul 28 08:00:00 KST
  "aug-6-skhynix": Date.UTC(2026, 7, 5, 23, 0, 0) / 1000, // Aug 6 08:00:00 KST
};

export default async function ReplayPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const replay = getReplay(slug);
  if (!replay) notFound();

  const baseT = REPLAY_START_UNIX[slug] ?? Math.floor(Date.now() / 1000);
  const scrubT = t ? Number(t) : baseT;

  const venues: Mic[] = replay.venues as Mic[];
  const venueStates = venues.map((mic) => ({ mic, ...resolveSessionWindow(mic, scrubT) }));

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <header className="mb-6 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-wide text-ink-muted">{replay.date}</div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{replay.title}</h1>
        <p className="mt-2 text-sm text-ink-secondary">{replay.summary}</p>
      </header>

      {/* Region 1: scrubber — playback/chapters need real candle-level data, not built. Deep
          link (?t=) is honored for the venue panel below. */}
      <section aria-label="Scrubber" className="mb-8">
        <div className="text-sm text-ink-muted">
          t = <span className="font-mono text-ink">{new Date(scrubT * 1000).toISOString()}</span>{" "}
          (<a href={`?t=${baseT}`} className="text-brand underline">reset to start</a>)
        </div>
      </section>

      {/* Region 2: venue panel — real, computed live from packages/calendars at t. */}
      <section aria-label="Venues at t" className="mb-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Venues at this moment</h2>
        <div className="flex gap-4">
          {venueStates.map((v) => (
            <div key={v.mic} className="rounded-control border border-border px-3 py-2 text-sm">
              <div className="font-mono text-xs text-ink-muted">{v.mic}</div>
              <div className="mt-1 text-ink">{SESSION_LABELS[v.session]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border pt-6 text-sm text-ink-muted">
        Print panel, perp panel, guards panel, sources drawer and conflicts box need a real
        incident data pipeline (candle history, print records, PolicyLens replay runs) that
        isn&apos;t built yet.
      </section>
    </main>
  );
}
