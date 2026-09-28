// Mirrors packages/contracts/src/libraries/PrintPolicy.sol exactly.

const SESSION_UNKNOWN = 0;
const SESSION_REGULAR = 1;
const SESSION_EXTENDED = 2;
const SESSION_AUCTION = 3;
const SESSION_CLOSED = 4;

const INTERRUPTION_UNKNOWN = 0;
const INTERRUPTION_ASSET_HALTED = 3;
const INTERRUPTION_VENUE_HALTED = 4;

export enum PrintVerdict {
  Unknown = 0,
  Accept = 1,
  Flag = 2,
  Reject = 3,
}

export const PRINT_FLAG = {
  VENUE_CLOSED: 1 << 0,
  VENUE_HALTED: 1 << 1,
  VENUE_EXTENDED: 1 << 2,
  VENUE_AUCTION: 1 << 3,
  FIRST_MINUTE: 1 << 4,
  PRIMARY_NOT_REGULAR: 1 << 5,
  PRIMARY_HALTED: 1 << 6,
  OUT_OF_HISTORY: 1 << 7,
  FUTURE_TS: 1 << 8,
} as const;

export interface PrintVenueState {
  found: boolean;
  outOfHistory: boolean;
  session: number;
  interruption: number;
  sessionStartedAt: bigint;
}

export interface SingleVerdict {
  verdict: PrintVerdict;
  flags: number;
  session: number;
  interruption: number;
}

export function verdictSingle(venue: PrintVenueState, printTs: bigint, nowTs: bigint): SingleVerdict {
  let flags = 0;
  if (printTs > nowTs) flags |= PRINT_FLAG.FUTURE_TS;

  if (venue.outOfHistory) {
    flags |= PRINT_FLAG.OUT_OF_HISTORY;
    return { verdict: PrintVerdict.Unknown, flags, session: 0, interruption: 0 };
  }
  if (!venue.found) {
    return { verdict: PrintVerdict.Unknown, flags, session: 0, interruption: 0 };
  }

  const session = venue.session;
  const interruption = venue.interruption;

  if (session === SESSION_CLOSED) flags |= PRINT_FLAG.VENUE_CLOSED;
  if (interruption === INTERRUPTION_ASSET_HALTED || interruption === INTERRUPTION_VENUE_HALTED) {
    flags |= PRINT_FLAG.VENUE_HALTED;
  }
  if (session === SESSION_EXTENDED) flags |= PRINT_FLAG.VENUE_EXTENDED;
  if (session === SESSION_AUCTION) flags |= PRINT_FLAG.VENUE_AUCTION;
  if (venue.sessionStartedAt !== 0n && printTs >= venue.sessionStartedAt && printTs - venue.sessionStartedAt < 60n) {
    flags |= PRINT_FLAG.FIRST_MINUTE;
  }

  const verdict = verdictFromFlags(flags, session, interruption);
  return { verdict, flags, session, interruption };
}

export interface SecondaryVerdict {
  verdict: PrintVerdict;
  flags: number;
}

export function verdictSecondary(
  venue: PrintVenueState,
  primary: PrintVenueState,
  printTs: bigint,
  nowTs: bigint,
): SecondaryVerdict {
  const single = verdictSingle(venue, printTs, nowTs);
  let { verdict, flags } = single;
  const { session, interruption } = single;

  if (flags & PRINT_FLAG.OUT_OF_HISTORY) return { verdict, flags };

  if (primary.outOfHistory || !primary.found) {
    return { verdict, flags };
  }

  if (primary.session !== SESSION_REGULAR) flags |= PRINT_FLAG.PRIMARY_NOT_REGULAR;
  if (primary.interruption === INTERRUPTION_ASSET_HALTED || primary.interruption === INTERRUPTION_VENUE_HALTED) {
    flags |= PRINT_FLAG.PRIMARY_HALTED;
  }

  verdict = verdictFromFlags(flags, session, interruption);
  return { verdict, flags };
}

function verdictFromFlags(flags: number, session: number, interruption: number): PrintVerdict {
  if (flags & PRINT_FLAG.FUTURE_TS) return PrintVerdict.Reject;
  if (flags & PRINT_FLAG.VENUE_CLOSED) return PrintVerdict.Reject;
  if (flags & PRINT_FLAG.VENUE_HALTED) return PrintVerdict.Reject;
  if (flags & PRINT_FLAG.FIRST_MINUTE && flags & PRINT_FLAG.PRIMARY_NOT_REGULAR) return PrintVerdict.Reject;

  if (session === SESSION_UNKNOWN || interruption === INTERRUPTION_UNKNOWN) return PrintVerdict.Unknown;

  if (flags !== 0) return PrintVerdict.Flag;

  return PrintVerdict.Accept;
}
