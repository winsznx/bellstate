import type { SupabaseClient } from "@supabase/supabase-js";

/** packages/db/supabase/migrations/20260927150000_schema.sql's `perp_markets` (§9.1). */
export interface PerpMarketRow {
  dex: string;
  name: string;
  underlying_listing_ids: string[];
  primary_listing_id: string | null;
  spec_url: string | null;
}

export async function fetchPerpMarkets(supabase: SupabaseClient, dex: string): Promise<PerpMarketRow[]> {
  const { data, error } = await supabase
    .from("perp_markets")
    .select("dex, name, underlying_listing_ids, primary_listing_id, spec_url")
    .eq("dex", dex)
    .returns<PerpMarketRow[]>();

  if (error) throw new Error(`perp_markets query failed: ${error.message}`);
  return data ?? [];
}

/** The columns this worker needs from `status_current` (§9.1) — see src/status.ts for why this
 * table, not `status_history`, is the live "at this instant" status source. */
export interface StatusCurrentRow {
  subject_id: string;
  record: Record<string, unknown>;
}

export async function fetchMarketStatuses(supabase: SupabaseClient, listingIds: string[]): Promise<Map<string, StatusCurrentRow>> {
  const byListingId = new Map<string, StatusCurrentRow>();
  if (listingIds.length === 0) return byListingId;

  const { data, error } = await supabase
    .from("status_current")
    .select("subject_id, record")
    .eq("facet", "market")
    .in("subject_id", listingIds)
    .returns<StatusCurrentRow[]>();

  if (error) throw new Error(`status_current query failed: ${error.message}`);
  for (const row of data ?? []) byListingId.set(row.subject_id, row);
  return byListingId;
}

export interface PerpSnapshotInsert {
  name: string;
  t: string;
  oracle_px: number;
  mark_px: number;
}

export async function insertPerpSnapshots(supabase: SupabaseClient, rows: PerpSnapshotInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("perp_snapshots").insert(rows);
  if (error) throw new Error(`perp_snapshots insert failed: ${error.message}`);
}

export interface OracleWatchEventInsert {
  name: string;
  flag: string;
  window_start: string;
  window_end: string;
  move_pct: number;
  status_context: Record<string, unknown>;
}

export async function insertOracleWatchEvents(supabase: SupabaseClient, rows: OracleWatchEventInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("oracle_watch_events").insert(rows);
  if (error) throw new Error(`oracle_watch_events insert failed: ${error.message}`);
}
