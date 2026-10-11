import { notFound } from "next/navigation";
import { resolveSessionWindow, type Mic } from "@winsznx/bellstate-calendars";
import { SESSION_LABELS } from "@winsznx/bellstate-ui";
import { supabaseServerClient } from "../../lib/supabase";
import { JULY_28_SLUG, july28Sources } from "../caseStudy";

const VALID_MICS = new Set<Mic>(["XNAS", "XNYS", "ARCX", "XASE", "XHKG", "XKRX", "NXTE"]);

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand">{children}</a>;
}

function July28CaseStudy() {
  return <main className="mx-auto max-w-[900px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
    <LinkBack />
    <header className="border-b border-border pb-7">
      <p className="text-xs font-semibold text-ink-muted">Historical case study · July 28, 2026</p>
      <h1 className="mt-2 max-w-[700px] text-3xl font-semibold leading-tight text-ink sm:text-4xl">One share at the lower limit</h1>
      <p className="mt-3 max-w-[700px] text-sm leading-6 text-ink-secondary">At the Nextrade pre-market open, one SK hynix share traded at ₩1,272,000. A linked perpetual market then moved sharply and liquidated long positions. This timeline summarizes published reports; it is not a signed Bellstate replay or an executable guard verdict.</p>
    </header>
    <section aria-label="Reported sequence" className="py-7">
      <h2 className="text-lg font-semibold">What happened</h2>
      <ol className="mt-5 space-y-6 border-l border-border pl-5">
        <li><p className="text-sm font-semibold">08:00 KST · Nextrade pre-market opens</p><p className="mt-1 text-sm leading-6 text-ink-secondary">Nextrade publishes pre-market hours of 08:00–08:50. <SourceLink href={july28Sources.nxt}>Nextrade trading hours</SourceLink></p></li>
        <li><p className="text-sm font-semibold">Shortly after open · One-share print</p><p className="mt-1 text-sm leading-6 text-ink-secondary">SBS reported a single share executed at ₩1,272,000, the lower price limit. Its report does not supply a trade-level timestamp. <SourceLink href={july28Sources.report}>SBS report</SourceLink></p></li>
        <li><p className="text-sm font-semibold">After the print · Linked perp reprices</p><p className="mt-1 text-sm leading-6 text-ink-secondary">Nexus Mutual’s incident analysis reports the xyz:SKHYNIX perpetual repriced from $1,131.40 to $954.99 and triggered liquidations. These are reported figures, not exchange-verified frames in Bellstate. <SourceLink href={july28Sources.nexus}>Incident analysis</SourceLink></p></li>
      </ol>
    </section>
    <section className="grid gap-5 border-t border-border py-7 sm:grid-cols-2" aria-label="Reported impact">
      <div><h2 className="text-lg font-semibold">Reported impact</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">Nexus Mutual cites 960 liquidated long accounts, $57.4 million in closed position value and about $17.3 million in realized margin losses. These are different measures; they must not be added together or presented as audited Bellstate data. <SourceLink href={july28Sources.nexus}>Incident analysis</SourceLink></p></div>
      <div><h2 className="text-lg font-semibold">A repeated opening risk</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">SBS reported another SK hynix lower-limit print on Nextrade at the August 6 pre-market open, this time involving 11 shares. <SourceLink href={july28Sources.followup}>SBS follow-up</SourceLink></p></div>
    </section>
    <section className="border-t border-border py-7"><h2 className="text-lg font-semibold">Replay evidence</h2><p className="mt-2 max-w-[700px] text-sm leading-6 text-ink-secondary">No verified, time-indexed Bellstate frames are published for this incident. A scrubber, session transitions, guard decisions and historical candles will appear only when their inputs and provenance have been reviewed and published.</p></section>
  </main>;
}

function LinkBack() { return <a href="/replay" className="mb-5 inline-block text-sm text-brand underline underline-offset-2">All replays</a>; }

export default async function ReplayPlayerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params;
  const { t } = await searchParams;
  const db = supabaseServerClient();
  if (!db) return slug === JULY_28_SLUG ? <July28CaseStudy /> : <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold">Replay</h1><p className="mt-4 text-ink-secondary">Replay data is unavailable in this environment.</p></main>;
  const { data: replay, error } = await db.from("replays").select("slug,title,summary,venue_mics,starts_at,ends_at").eq("slug", slug).eq("published", true).maybeSingle();
  if (error) return slug === JULY_28_SLUG ? <July28CaseStudy /> : <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold">Replay</h1><p className="mt-4 text-ink-secondary">Could not load this replay. Try again later.</p></main>;
  if (!replay) return slug === JULY_28_SLUG ? <July28CaseStudy /> : notFound();
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
