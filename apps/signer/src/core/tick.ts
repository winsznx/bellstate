import {
  deriveMarket,
  deriveProgram,
  derivePrimary,
  deriveValuation,
  type Listing,
  type MarketSnapshot,
  type MarketState,
  type PrimaryCatalogView,
  type PrimaryState,
  type ProgramSnapshot,
  type ProgramState,
  type ValuationMarketView,
  type ValuationReport,
  type ValuationState,
} from "@winsznx/bellstate-engine";
import {
  buildMarketUpdateMessage,
  buildPrimaryUpdateMessage,
  buildProgramUpdateMessage,
  buildValuationUpdateMessage,
  DOMAIN_IDS,
  epochOf,
  type HeartbeatMessage,
  type MarketUpdateMessage,
  type PrimaryUpdateMessage,
  type ProgramUpdateMessage,
  type ValuationUpdateMessage,
} from "@winsznx/bellstate-protocol";

type MarketDomain = "US_MARKETS" | "HK_MARKETS" | "KR_MARKETS";
type Domain = keyof typeof DOMAIN_IDS;

function statesEqual<T>(a: T, b: T | null): boolean {
  if (b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface ListingSubject {
  listing: Listing;
  domain: MarketDomain;
  snapshot: MarketSnapshot;
  onchainSeq: number;
  /** null when the record has never been attested (always counts as a diff). */
  onchainState: MarketState | null;
}

export interface ProgramSubject {
  programId: `0x${string}`;
  snapshot: ProgramSnapshot;
  onchainSeq: number;
  onchainState: ProgramState | null;
}

export interface PrimarySubject {
  programId: `0x${string}`;
  catalog: PrimaryCatalogView;
  onchainSeq: number;
  onchainState: PrimaryState | null;
}

export interface ValuationSubject {
  programId: `0x${string}`;
  report: ValuationReport | null;
  market: ValuationMarketView;
  onchainSeq: number;
  onchainState: ValuationState | null;
}

export interface DomainVersion {
  version: bigint;
}

export interface TickInput {
  t: number;
  calendarVersion: number;
  listings: ListingSubject[];
  programs: ProgramSubject[];
  primaries: PrimarySubject[];
  valuations: ValuationSubject[];
  domainVersions: Record<Domain, DomainVersion>;
}

export interface TickResult {
  marketUpdates: { listingId: `0x${string}`; message: MarketUpdateMessage }[];
  programUpdates: { programId: `0x${string}`; message: ProgramUpdateMessage }[];
  primaryUpdates: { programId: `0x${string}`; message: PrimaryUpdateMessage }[];
  valuationUpdates: { programId: `0x${string}`; message: ValuationUpdateMessage }[];
  heartbeats: { domain: Domain; message: HeartbeatMessage }[];
}

/**
 * PRD §8.1's Core tick, steps 2-5 (pull-snapshots and POST-to-aggregators are the DO's job, not
 * this pure function's). Diffs each subject's freshly derived state against the onchain view by
 * structural equality on the ERC-8392 + Bellstate-extension fields (never seq/writtenAt/
 * effectiveAsOf, which are onchain bookkeeping this function doesn't see).
 */
export function tick(input: TickInput): TickResult {
  const { t, calendarVersion, domainVersions } = input;
  const epoch = epochOf(t);

  const result: TickResult = {
    marketUpdates: [],
    programUpdates: [],
    primaryUpdates: [],
    valuationUpdates: [],
    heartbeats: [],
  };

  const domainHasDiff = new Map<Domain, boolean>();
  const domainHasSubject = new Map<Domain, boolean>();
  const touch = (domain: Domain, diff: boolean) => {
    domainHasSubject.set(domain, true);
    if (diff) domainHasDiff.set(domain, true);
  };

  for (const subject of input.listings) {
    const derived = deriveMarket(subject.listing, t, subject.snapshot);
    const diff = !statesEqual(derived, subject.onchainState);
    touch(subject.domain, diff);
    if (diff) {
      result.marketUpdates.push({
        listingId: subject.listing.listingId,
        message: buildMarketUpdateMessage(subject.listing.listingId, subject.onchainSeq + 1, epoch, derived, calendarVersion),
      });
    }
  }

  for (const subject of input.programs) {
    const derived = deriveProgram(subject.programId, t, subject.snapshot);
    const diff = !statesEqual(derived, subject.onchainState);
    touch("PROGRAMS", diff);
    if (diff) {
      result.programUpdates.push({
        programId: subject.programId,
        message: buildProgramUpdateMessage(subject.programId, subject.onchainSeq + 1, epoch, derived),
      });
    }
  }

  for (const subject of input.primaries) {
    const derived = derivePrimary(subject.programId, t, subject.catalog);
    const diff = !statesEqual(derived, subject.onchainState);
    touch("PRIMARY", diff);
    if (diff) {
      result.primaryUpdates.push({
        programId: subject.programId,
        message: buildPrimaryUpdateMessage(subject.programId, subject.onchainSeq + 1, epoch, derived),
      });
    }
  }

  for (const subject of input.valuations) {
    const derived = deriveValuation(subject.programId, t, subject.report, subject.market);
    const diff = !statesEqual(derived, subject.onchainState);
    touch("VALUATION", diff);
    if (diff) {
      result.valuationUpdates.push({
        programId: subject.programId,
        message: buildValuationUpdateMessage(subject.programId, subject.onchainSeq + 1, epoch, derived),
      });
    }
  }

  for (const domain of Object.keys(DOMAIN_IDS) as Domain[]) {
    if (domainHasSubject.get(domain) && !domainHasDiff.get(domain)) {
      result.heartbeats.push({
        domain,
        message: {
          domain: DOMAIN_IDS[domain],
          version: domainVersions[domain].version,
          epoch,
          calendarVersion,
        },
      });
    }
  }

  return result;
}
