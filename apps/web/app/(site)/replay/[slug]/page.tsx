import { notFound } from "next/navigation";
import { resolveSessionWindow, type Mic } from "@winsznx/bellstate-calendars";
import { SESSION_LABELS } from "@winsznx/bellstate-ui";
import { supabaseServerClient } from "../../lib/supabase";

const VALID_MICS = new Set<Mic>(["XNAS", "XNYS", "ARCX", "XASE", "XHKG", "XKRX", "NXTE"]);

export default async function ReplayPlayerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params;
  const { t } = await searchParams;
  const db = supabaseServerClient();
  if (!db) return <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold">Replay</h1><p className="mt-4 text-ink-secondary">Replay data is unavailable in this environment.</p></main>;
  const { data: replay, error } = await db.from("replays").select("slug,title,summary,venue_mics,starts_at,ends_at").eq("slug", slug).eq("published", true).maybeSingle();
  if (error) return <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold">Replay</h1><p className="mt-4 text-ink-secondary">Could not load this replay. Try again later.</p></main>;
  if (!replay) notFound();
  const start = Date.parse(replay.starts_at);
  const end = Date.parse(replay.ends_at);
  const requested = t ? Number(t) * 1000 : start;
  const at = Number.isFinite(requested) && requested >= start && requested <= end ? requested : start;
  const { data: frames, error: framesError } = await db.from("replay_frames").select("id,t,kind,payload,provenance").eq("replay_slug", slug).lte("t", new Date(at).toISOString()).order("t", { ascending: false }).limit(20);
  const venues = (replay.venue_mics as string[]).filter((mic): mic is Mic => VALID_MICS.has(mic as Mic));
  return (
    <main className="mx-auto max-w-[900px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 border-b border-border pb-6"><time className="text-xs text-ink-muted" dateTime={replay.starts_at}>{new Date(start).toLocaleDateString()}</time><h1 className="mt-1 text-2xl font-semibold">{replay.title}</h1>{replay.summary && <p className="mt-2 text-sm text-ink-secondary">{replay.summary}</p>}</header>
      <section aria-label="Replay time" className="mb-8"><h2 className="mb-2 text-lg font-semibold">At this moment</h2><p className="break-all font-mono text-xs">{new Date(at).toISOString()}</p><a href={`?t=${Math.floor(start / 1000)}`} className="mt-2 inline-block text-sm text-brand underline">Reset to start</a></section>
      <section aria-label="Venues at this moment" className="mb-8 border-t border-border pt-6"><h2 className="mb-3 text-lg font-semibold">Venue sessions</h2><div className="flex flex-wrap gap-4">{venues.map((mic) => { const state = resolveSessionWindow(mic, Math.floor(at / 1000)); return <div key={mic} className="rounded-control border border-border px-3 py-2 text-sm"><div className="font-mono text-xs text-ink-muted">{mic}</div><div className="mt-1">{SESSION_LABELS[state.session]}</div></div>; })}</div></section>
      <section aria-label="Recorded frames" className="border-t border-border pt-6"><h2 className="mb-3 text-lg font-semibold">Recorded evidence</h2>{framesError ? <p className="text-sm text-ink-secondary">Could not load replay frames.</p> : !frames?.length ? <p className="text-sm text-ink-secondary">No recorded frames at or before this time.</p> : <ol className="space-y-3">{frames.map((frame) => <li key={frame.id} className="rounded-control border border-border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{frame.kind}</strong><time className="font-mono text-xs text-ink-muted" dateTime={frame.t}>{new Date(frame.t).toLocaleString()}</time></div><pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(frame.payload, null, 2)}</pre><p className="mt-2 text-xs text-ink-muted">Provenance: {JSON.stringify(frame.provenance)}</p></li>)}</ol>}</section>
    </main>
  );
}
