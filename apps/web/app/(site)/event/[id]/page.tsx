import { notFound } from "next/navigation";
import { supabaseServerClient } from "../../lib/supabase";

type History = {
  id: string;
  facet: string;
  subject_id: string;
  record: Record<string, unknown>;
  seq: number;
  tx_hash: string | null;
  block_number: number | null;
  t_source: string | null;
  t_first_seen: string | null;
  t_quorum: string | null;
  t_submitted: string | null;
  t_included: string | null;
  t_indexed: string | null;
  source_refs: unknown;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseServerClient();
  if (!db) return <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold">Event</h1><p className="mt-4 text-ink-secondary">Event data is unavailable in this environment.</p></main>;

  const { data, error } = await db.from("status_history").select("id,facet,subject_id,record,seq,tx_hash,block_number,t_source,t_first_seen,t_quorum,t_submitted,t_included,t_indexed,source_refs").eq("id", id).maybeSingle();
  if (error) return <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold">Event</h1><p className="mt-4 text-ink-secondary">Could not load this event. Try again later.</p></main>;
  if (!data) notFound();
  const event = data as History;
  const [{ data: previous }, { data: listing }, { data: program }] = await Promise.all([
    db.from("status_history").select("record").eq("facet", event.facet).eq("subject_id", event.subject_id).lt("seq", event.seq).order("seq", { ascending: false }).limit(1).maybeSingle(),
    db.from("listings").select("mic,symbol").eq("listing_id", event.subject_id).maybeSingle(),
    db.from("programs").select("symbol").eq("program_id", event.subject_id).maybeSingle(),
  ]);
  const before = (previous?.record ?? {}) as Record<string, unknown>;
  const after = event.record ?? {};
  const fields = Object.keys(after).filter((key) => formatValue(before[key]) !== formatValue(after[key]));
  const stamps = [
    ["Source observed", event.t_source], ["First seen", event.t_first_seen],
    ["Quorum reached", event.t_quorum], ["Submitted", event.t_submitted],
    ["Included onchain", event.t_included], ["Indexed", event.t_indexed],
  ];
  const subject = listing ? `${listing.mic}:${listing.symbol}` : program?.symbol ?? event.subject_id;
  const shareUrl = `https://bellstate.app/event/${event.id}`;

  return (
    <main className="mx-auto max-w-[900px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 border-b border-border pb-6">
        <p className="text-xs text-ink-muted">{subject} · {event.facet} · sequence {event.seq}</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Status change</h1>
        <p className="mt-2 text-sm text-ink-secondary">Recorded {event.t_included ? new Date(event.t_included).toLocaleString() : "onchain time unavailable"}.</p>
      </header>
      <section className="mb-8" aria-label="Changed fields"><h2 className="mb-3 text-lg font-semibold">What changed</h2>
        {fields.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b border-border"><th className="py-2 pr-3">Field</th><th className="py-2 pr-3">Before</th><th className="py-2">After</th></tr></thead><tbody>{fields.map((field) => <tr key={field} className="border-b border-border"><th className="py-2 pr-3 font-medium">{field}</th><td className="break-all py-2 pr-3 text-ink-secondary">{formatValue(before[field])}</td><td className="break-all py-2">{formatValue(after[field])}</td></tr>)}</tbody></table></div> : <p className="text-sm text-ink-secondary">No changed fields are available for this record.</p>}
      </section>
      <section className="mb-8 border-t border-border pt-6" aria-label="Latency"><h2 className="mb-3 text-lg font-semibold">Latency</h2><dl className="space-y-2 text-sm">{stamps.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-1"><dt className="text-ink-secondary">{label}</dt><dd className="font-mono text-xs">{value ? new Date(value).toLocaleString() : "—"}</dd></div>)}</dl></section>
      <section className="mb-8 border-t border-border pt-6" aria-label="Evidence"><h2 className="mb-3 text-lg font-semibold">Evidence</h2>
        <dl className="space-y-2 text-sm"><div><dt className="text-ink-secondary">Transaction</dt><dd className="break-all font-mono text-xs">{event.tx_hash ?? "Not recorded"}</dd></div><div><dt className="text-ink-secondary">Block</dt><dd>{event.block_number ?? "Not recorded"}</dd></div></dl>
        <h3 className="mt-5 font-medium">Source references</h3><pre className="mt-2 overflow-x-auto rounded-control bg-surface-muted p-3 text-xs">{JSON.stringify(event.source_refs ?? [], null, 2)}</pre>
        <h3 className="mt-5 font-medium">Signed attestations</h3><p className="mt-2 text-sm text-ink-secondary">Signature evidence is not available through the public data API.</p>
      </section>
      <footer className="border-t border-border pt-6"><a className="text-sm text-brand underline" href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}>Share this event</a></footer>
    </main>
  );
}
