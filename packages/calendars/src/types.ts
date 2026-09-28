export type Mic = "XNAS" | "XNYS" | "ARCX" | "XASE" | "XHKG" | "XKRX" | "NXTE";

export type Session = "UNKNOWN" | "REGULAR" | "EXTENDED" | "AUCTION" | "CLOSED";

export interface SessionWindow {
  session: Session;
  sessionSince: number;
  nextScheduledTransition: number;
}

/** PRD §3.9: "Pin the calendar version. Each signer attests with the calendar version compiled
 * into its build." Bump on any change to holidays.ts or templates.ts. */
export const CALENDAR_VERSION = 1;
