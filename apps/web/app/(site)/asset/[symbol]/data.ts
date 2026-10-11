import {
  INTERRUPTIONS,
  LIFECYCLES,
  PRIMARY_REASONS,
  PROGRAM_REASONS,
  PROGRAM_STATUSES,
  REASON_CATEGORIES,
  REQUEST_STATES,
  SESSIONS,
  VALUATION_CONDITIONS,
  type MarketState,
  type PrimaryState,
  type ProgramState,
  type ValuationState,
} from "@winsznx/bellstate-engine";
import { supabaseServerClient } from "../../lib/supabase";
import { loadCatalogAsset, type CatalogAsset } from "../../lib/xstocksCatalog";

type Facet = "market" | "program" | "primary" | "valuation";
type Status = {
  facet: Facet;
  subject_id: string;
  record: Record<string, unknown>;
  effective_as_of: string;
  written_at: string;
  tx_hash: string | null;
};
const select = <T extends string>(
  values: readonly T[],
  index: unknown,
  fallback: T,
): T =>
  typeof index === "number" && Number.isInteger(index) && values[index]
    ? values[index]
    : fallback;
const seconds = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};
const SOURCE_STATUSES = ["UNKNOWN", "OPEN", "CLOSED"] as const;

export interface AssetDetail {
  source: "issuer catalog" | "indexed";
  logo: string | null;
  tradingHoursMode: string | null;
  symbol: string;
  name: string;
  issuer: string;
  isin: string | null;
  underlyingIsin: string | null;
  mic: string | null;
  venueName: string | null;
  rawTokenAddress: string | null;
  wrapperAddress: string | null;
  rawAdapterAddress: string | null;
  wrapperAdapterAddress: string | null;
  programActive: boolean;
  market: MarketState | null;
  program: ProgramState | null;
  primary: PrimaryState | null;
  valuation: ValuationState | null;
  facets: Partial<
    Record<
      Facet,
      { effectiveAsOf: string; writtenAt: string; txHash: string | null }
    >
  >;
}

function catalogDetail(asset: CatalogAsset): AssetDetail {
  return {
    source: "issuer catalog",
    logo: asset.logo,
    tradingHoursMode: asset.tradingHoursMode,
    symbol: asset.symbol,
    name: asset.name,
    issuer: "xStocks by Backed",
    isin: asset.isin,
    underlyingIsin: asset.underlyingIsin,
    mic: asset.mic,
    venueName: asset.venueName,
    rawTokenAddress: asset.rawTokenAddress,
    wrapperAddress: asset.wrapperAddress,
    rawAdapterAddress: null,
    wrapperAdapterAddress: null,
    programActive: false,
    market: null,
    program: null,
    primary: null,
    valuation: null,
    facets: {},
  };
}

export async function loadAssetDetail(
  symbol: string,
): Promise<{ asset: AssetDetail | null; error: string | null }> {
  const catalog = await loadCatalogAsset(symbol).catch(() => null);
  const client = supabaseServerClient();
  if (!client)
    return {
      asset: catalog ? catalogDetail(catalog) : null,
      error: catalog ? null : "Live data is not configured in this environment.",
    };
  const { data: program, error } = await client
    .from("programs")
    .select(
      "program_id,symbol,name,issuer,isin,underlying_isin,reference_listing_id,active",
    )
    .ilike("symbol", symbol)
    .maybeSingle();
  if (error) return { asset: catalog ? catalogDetail(catalog) : null, error: catalog ? null : error.message };
  if (!program) return { asset: catalog ? catalogDetail(catalog) : null, error: null };
  const [listingResult, tokensResult, statusResult] = await Promise.all([
    program.reference_listing_id
      ? client
          .from("listings")
          .select("listing_id,mic,symbol,isin")
          .eq("listing_id", program.reference_listing_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from("tokens")
      .select("address,kind,adapter")
      .eq("program_id", program.program_id),
    client
      .from("status_current")
      .select("facet,subject_id,record,effective_as_of,written_at,tx_hash")
      .in(
        "subject_id",
        [program.program_id, program.reference_listing_id].filter(Boolean),
      ),
  ]);
  const failure =
    listingResult.error ?? tokensResult.error ?? statusResult.error;
  if (failure) return { asset: null, error: failure.message };
  const listing = listingResult.data;
  const venueResult = listing
    ? await client
        .from("venues")
        .select("name")
        .eq("mic", listing.mic)
        .maybeSingle()
    : { data: null, error: null };
  if (venueResult.error)
    return { asset: null, error: venueResult.error.message };
  const statuses = statusResult.data as Status[] | null;
  const facet = (name: Facet, id: string | null) =>
    statuses?.find(
      (status) => status.facet === name && status.subject_id === id,
    );
  const marketStatus = facet("market", listing?.listing_id ?? null);
  const programStatus = facet("program", program.program_id);
  const primaryStatus = facet("primary", program.program_id);
  const valuationStatus = facet("valuation", program.program_id);
  const m = marketStatus?.record,
    p = programStatus?.record,
    r = primaryStatus?.record,
    v = valuationStatus?.record;
  const marketExpired = seconds(m?.nextScheduledTransition) > 0 &&
    seconds(m?.nextScheduledTransition) <= Date.now() / 1000;
  const facets: AssetDetail["facets"] = {};
  for (const status of statuses ?? [])
    facets[status.facet] = {
      effectiveAsOf: status.effective_as_of,
      writtenAt: status.written_at,
      txHash: status.tx_hash,
    };
  const raw = tokensResult.data?.find((token) => token.kind === "raw");
  const wrapped = tokensResult.data?.find((token) => token.kind === "wrapped");
  return {
    error: null,
    asset: {
      source: "indexed",
      logo: catalog?.logo ?? null,
      tradingHoursMode: catalog?.tradingHoursMode ?? null,
      symbol: program.symbol,
      name: program.name ?? program.symbol,
      issuer: program.issuer,
      isin: program.isin,
      underlyingIsin: program.underlying_isin,
      mic: listing?.mic ?? null,
      venueName: venueResult.data?.name ?? listing?.mic ?? null,
      rawTokenAddress: raw?.address ?? null,
      wrapperAddress: wrapped?.address ?? null,
      rawAdapterAddress: raw?.adapter ?? null,
      wrapperAdapterAddress: wrapped?.adapter ?? null,
      programActive: program.active,
      facets,
      market: m
        ? ({
            session: marketExpired ? "UNKNOWN" : select(SESSIONS, m.session, "UNKNOWN"),
            interruption: marketExpired ? "UNKNOWN" : select(INTERRUPTIONS, m.interruption, "UNKNOWN"),
            reasonCategory: select(REASON_CATEGORIES, m.reasonCategory, "NONE"),
            reasonCode:
              typeof m.reasonCode === "string" ? m.reasonCode : "NONE",
            sessionSince: seconds(m.sessionSince),
            interruptionSince: seconds(m.interruptionSince),
            nextScheduledTransition: seconds(m.nextScheduledTransition),
            expectedResumption: seconds(m.expectedResumption),
          } satisfies MarketState)
        : null,
      program: p
        ? ({
            lifecycle: select(LIFECYCLES, p.lifecycle, "UNKNOWN"),
            lifecycleOverride: null,
            programStatus: select(PROGRAM_STATUSES, p.programStatus, "UNKNOWN"),
            programReason: select(PROGRAM_REASONS, p.programReason, "NONE"),
          } satisfies ProgramState)
        : null,
      primary: r
        ? ({
            issuance: {
              state: select(REQUEST_STATES, r.issuance, "UNKNOWN"),
              reason: select(PRIMARY_REASONS, r.primaryReason, "NONE"),
            },
            redemption: {
              state: select(REQUEST_STATES, r.redemption, "UNKNOWN"),
              reason: select(PRIMARY_REASONS, r.primaryReason, "NONE"),
            },
            nextScheduledChange: seconds(r.nextScheduledChange),
            nextCutoff: seconds(r.nextCutoff),
          } satisfies PrimaryState)
        : null,
      valuation: v
        ? ({
            condition: select(VALUATION_CONDITIONS, v.condition, "UNKNOWN"),
            conditionSince: seconds(v.conditionSince),
            valueAsOf: seconds(v.valueAsOf),
            nextExpectedUpdate: seconds(v.nextExpectedUpdate),
            sourceMarketStatus: select(
              SOURCE_STATUSES,
              v.sourceMarketStatus,
              "UNKNOWN",
            ),
          } satisfies ValuationState)
        : null,
    },
  };
}
