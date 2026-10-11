import Link from "next/link";
import { supabaseServerClient } from "../lib/supabase";

export const dynamic = "force-dynamic";

export default async function ReplaysPage() {
  const db = supabaseServerClient();
  const result = db ? await db.from("replays").select("slug,title,summary,venue_mics,starts_at,ends_at").eq("published", true).order("starts_at", { ascending: false }) : null;
  return (
    <main className="mx-auto max-w-[900px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-6 text-3xl font-semibold text-ink">Replays</h1>
      {!db ? <p className="text-sm text-ink-secondary">Replay data is unavailable in this environment.</p> : result?.error ? <p className="text-sm text-ink-secondary">Could not load replays. Try again later.</p> : !result?.data?.length ? <p className="text-sm text-ink-secondary">No published replays yet.</p> : <div className="space-y-4">{result.data.map((replay) => (
        <Link key={replay.slug} href={`/replay/${encodeURIComponent(replay.slug)}`} className="block rounded-panel border border-border bg-surface p-4 hover:bg-surface-muted">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-ink">{replay.title}</h2><time className="font-mono text-xs text-ink-muted" dateTime={replay.starts_at}>{new Date(replay.starts_at).toLocaleDateString()}</time></div>
          {replay.summary && <p className="mt-1 text-sm text-ink-secondary">{replay.summary}</p>}
          <p className="mt-2 text-xs text-ink-muted">{replay.venue_mics.join(" · ")}</p>
        </Link>
      ))}</div>}
    </main>
  );
}
