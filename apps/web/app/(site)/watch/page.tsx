import { supabaseServerClient } from "../lib/supabase";

export const dynamic = "force-dynamic";

export default async function WatchPage() {
  const db = supabaseServerClient();
  const [marketsResult, flagsResult] = db ? await Promise.all([
    db.from("perp_markets").select("dex,name,underlying_listing_ids,primary_listing_id").order("dex").order("name"),
    db.from("oracle_watch_events").select("id,name,flag,window_start,move_pct,status_context").order("window_start", { ascending: false }).limit(20),
  ]) : [null, null];
  const markets = marketsResult?.data ?? [];
  const names = markets.map((market) => market.name);
  const snapshotsResult = db && names.length ? await db.from("perp_snapshots").select("name,t,oracle_px,mark_px").in("name", names).order("t", { ascending: false }).limit(200) : null;
  const newest = new Map<string, { t: string; oracle_px: number | null; mark_px: number | null }>();
  for (const snapshot of snapshotsResult?.data ?? []) if (!newest.has(snapshot.name)) newest.set(snapshot.name, snapshot);
  const flags = flagsResult?.data ?? [];
  return (
    <main className="mx-auto max-w-[1200px] min-w-0 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-2 text-3xl font-semibold text-ink">Oracle Watch</h1>
      <p className="mb-6 text-sm text-ink-secondary">Recorded equity perp prices and reference markets.</p>
      {!db ? <p className="text-sm text-ink-secondary">Watch data is unavailable in this environment.</p> : marketsResult?.error || flagsResult?.error || snapshotsResult?.error ? <p className="text-sm text-ink-secondary">Could not load Watch data. Try again later.</p> : <>
        <section aria-label="Markets" className="mb-8"><h2 className="mb-3 text-lg font-semibold">Markets</h2>{!markets.length ? <p className="text-sm text-ink-secondary">No perp markets are registered yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{markets.map((market) => { const snapshot = newest.get(market.name); const flag = flags.find((item) => item.name === market.name); return <article key={`${market.dex}:${market.name}`} className="rounded-panel border border-border p-4"><h3 className="font-semibold">{market.dex}:{market.name}</h3><p className="mt-1 break-all text-xs text-ink-muted">Reference listing IDs: {market.underlying_listing_ids.length ? market.underlying_listing_ids.join(", ") : "Not mapped"}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-ink-muted">Oracle</dt><dd>{snapshot?.oracle_px ?? "—"}</dd></div><div><dt className="text-ink-muted">Mark</dt><dd>{snapshot?.mark_px ?? "—"}</dd></div></dl><p className="mt-3 text-xs text-ink-muted">{snapshot ? `Last recorded ${new Date(snapshot.t).toLocaleString()}` : "No price snapshot recorded"}</p>{flag && <p className="mt-2 text-xs font-medium text-close">Latest flag: {flag.flag}</p>}</article>; })}</div>}</section>
        <section aria-label="Recent flags" className="border-t border-border pt-6"><h2 className="mb-3 text-lg font-semibold">Recent flags</h2>{!flags.length ? <p className="text-sm text-ink-secondary">No flags recorded yet.</p> : <ol className="space-y-2">{flags.map((flag) => <li key={flag.id} className="rounded-control border border-border p-3 text-sm"><strong>{flag.name}: {flag.flag}</strong><div className="mt-1 text-xs text-ink-muted">{new Date(flag.window_start).toLocaleString()}{flag.move_pct === null ? "" : ` · ${flag.move_pct}% move`}</div></li>)}</ol>}</section>
      </>}
    </main>
  );
}
