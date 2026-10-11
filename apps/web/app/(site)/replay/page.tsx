import Link from "next/link";
import { supabaseServerClient } from "../lib/supabase";
import { JULY_28_SLUG } from "./caseStudy";

export const dynamic = "force-dynamic";

export default async function ReplaysPage() {
  const db = supabaseServerClient();
  const result = db ? await db.from("replays").select("slug,title,summary,venue_mics,starts_at,ends_at").eq("published", true).order("starts_at", { ascending: false }) : null;
  return (
    <main className="mx-auto max-w-[900px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-6 text-3xl font-semibold text-ink">Replays</h1>
      <p className="mb-6 max-w-[650px] text-sm leading-6 text-ink-secondary">Follow a documented market incident, then compare it with Bellstate replay records when they are published.</p>
      {!result?.data?.some((replay) => replay.slug === JULY_28_SLUG) && <Link href={`/replay/${JULY_28_SLUG}`} className="mb-6 block rounded-panel border border-border bg-surface p-5 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand">
        <span className="text-xs font-semibold text-ink-muted">Historical case study · Reported events</span>
        <h2 className="mt-2 text-xl font-semibold text-ink">One share at the lower limit</h2>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">July 28, 2026 · SK hynix on Nextrade. A single pre-market trade was followed by a sharp move in a linked perpetual market.</p>
        <p className="mt-3 text-xs text-ink-muted">NXTE · XKRX · Source-linked timeline</p>
      </Link>}
      {!db ? <p className="text-sm text-ink-secondary">Published replay data is unavailable in this environment.</p> : result?.error ? <p className="text-sm text-ink-secondary">Could not load published replays. Try again later.</p> : !result?.data?.length ? <p className="text-sm text-ink-secondary">No Bellstate replay frames have been published yet.</p> : <div className="space-y-4">{result.data.map((replay) => (
        <Link key={replay.slug} href={`/replay/${encodeURIComponent(replay.slug)}`} className="block rounded-panel border border-border bg-surface p-4 hover:bg-surface-muted">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-ink">{replay.title}</h2><time className="font-mono text-xs text-ink-muted" dateTime={replay.starts_at}>{new Date(replay.starts_at).toLocaleDateString()}</time></div>
          {replay.summary && <p className="mt-1 text-sm text-ink-secondary">{replay.summary}</p>}
          <p className="mt-2 text-xs text-ink-muted">{replay.venue_mics.join(" · ")}</p>
        </Link>
      ))}</div>}
    </main>
  );
}
