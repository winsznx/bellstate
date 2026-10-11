import {
  INTERRUPTIONS,
  LIFECYCLES,
  REASON_CATEGORIES,
  REQUEST_STATES,
  SESSIONS,
  VALUATION_CONDITIONS,
  type MarketState,
} from "@winsznx/bellstate-engine";
import type { BoardRow } from "./types";
import { supabaseServerClient } from "../lib/supabase";

export interface BoardSnapshot {
  rows: BoardRow[];
  venues: { mic: string; venueName: string }[];
  events: {
    id: string;
    listingId: string | null;
    reason: string | null;
    haltedAt: string;
    sourceUrl: string;
  }[];
  fetchedAt: string;
  error: string | null;
}

type Status = {
  facet: string;
  subject_id: string;
  record: Record<string, unknown>;
  effective_as_of: string;
};
const enumValue = <T extends string>(
  values: readonly T[],
  value: unknown,
  fallback: T,
): T =>
  typeof value === "number" && Number.isInteger(value) && values[value]
    ? values[value]
    : fallback;
const seconds = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export async function loadBoard(): Promise<BoardSnapshot> {
  const empty: BoardSnapshot = {
    rows: [],
    venues: [],
    events: [],
    fetchedAt: new Date().toISOString(),
    error: null,
  };
  const client = supabaseServerClient();
  if (!client)
    return {
      ...empty,
      error: "Live data is not configured in this environment.",
    };
  const [venues, listings, programs, tokens, statuses, halts] =
    await Promise.all([
      client.from("venues").select("mic,name").order("mic"),
      client
        .from("listings")
        .select("listing_id,mic,symbol,name,isin,aliases")
        .eq("active", true),
      client
        .from("programs")
        .select("program_id,symbol,name,isin,reference_listing_id")
        .eq("active", true),
      client.from("tokens").select("address,program_id"),
      client
        .from("status_current")
        .select("facet,subject_id,record,effective_as_of"),
      client
        .from("halt_events")
        .select("id,listing_id,reason_code,halt_at,source_url")
        .order("halt_at", { ascending: false })
        .limit(20),
    ]);
  const failure = [venues, listings, programs, tokens, statuses, halts].find(
    (result) => result.error,
  );
  if (failure?.error)
    return {
      ...empty,
      error: `Live data could not be loaded: ${failure.error.message}`,
    };
  const listingById = new Map(
    (listings.data ?? []).map((listing) => [listing.listing_id, listing]),
  );
  const tokensByProgram = new Map<string, string[]>();
  for (const token of tokens.data ?? [])
    tokensByProgram.set(token.program_id, [
      ...(tokensByProgram.get(token.program_id) ?? []),
      token.address,
    ]);
  const statusByKey = new Map(
    ((statuses.data as Status[]) ?? []).map((status) => [
      `${status.facet}:${status.subject_id}`,
      status,
    ]),
  );
  const rows: BoardRow[] = (programs.data ?? []).map((program) => {
    const listing = program.reference_listing_id
      ? listingById.get(program.reference_listing_id)
      : undefined;
    const market = listing
      ? statusByKey.get(`market:${listing.listing_id}`)?.record
      : undefined;
    const transition = seconds(market?.nextScheduledTransition);
    const marketExpired = transition > 0 && transition <= Date.now() / 1000;
    const programStatus = statusByKey.get(
      `program:${program.program_id}`,
    )?.record;
    const primary = statusByKey.get(`primary:${program.program_id}`)?.record;
    const valuation = statusByKey.get(
      `valuation:${program.program_id}`,
    )?.record;
    return {
      symbol: program.symbol,
      underlyingSymbol: listing?.symbol ?? "—",
      name: program.name ?? listing?.name ?? program.symbol,
      mic: listing?.mic ?? "—",
      venueName:
        (venues.data ?? []).find((venue) => venue.mic === listing?.mic)?.name ??
        listing?.mic ??
        "Unlisted",
      listingId: listing?.listing_id,
      programId: program.program_id,
      isin: program.isin ?? listing?.isin ?? undefined,
      tokenAddresses: tokensByProgram.get(program.program_id) ?? [],
      effectiveAsOf: listing
        ? statusByKey.get(`market:${listing.listing_id}`)?.effective_as_of
        : undefined,
      market: {
        session: marketExpired ? "UNKNOWN" : enumValue(SESSIONS, market?.session, "UNKNOWN"),
        interruption: marketExpired ? "UNKNOWN" : enumValue(INTERRUPTIONS, market?.interruption, "UNKNOWN"),
        reasonCategory: enumValue(
          REASON_CATEGORIES,
          market?.reasonCategory,
          "NONE",
        ),
        reasonCode:
          typeof market?.reasonCode === "string" ? market.reasonCode : "NONE",
        sessionSince: seconds(market?.sessionSince),
        nextScheduledTransition: seconds(market?.nextScheduledTransition),
        interruptionSince: seconds(market?.interruptionSince),
        expectedResumption: seconds(market?.expectedResumption),
      } satisfies MarketState,
      valuationCondition: valuation
        ? enumValue(VALUATION_CONDITIONS, valuation.condition, "UNKNOWN")
        : "NOT_PROVIDED",
      primaryIssuance: enumValue(REQUEST_STATES, primary?.issuance, "UNKNOWN"),
      programLifecycle: enumValue(
        LIFECYCLES,
        programStatus?.lifecycle,
        "UNKNOWN",
      ),
    };
  });
  return {
    rows,
    venues: (venues.data ?? []).map((venue) => ({
      mic: venue.mic,
      venueName: venue.name,
    })),
    events: (halts.data ?? []).map((halt) => ({
      id: halt.id,
      listingId: halt.listing_id,
      reason: halt.reason_code,
      haltedAt: halt.halt_at,
      sourceUrl: halt.source_url,
    })),
    fetchedAt: new Date().toISOString(),
    error: null,
  };
}
