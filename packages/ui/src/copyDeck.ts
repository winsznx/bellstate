import type { MarketState } from "@winsznx/bellstate-engine";
import type { Mic } from "@winsznx/bellstate-calendars";
import { formatVenueTime } from "./format.js";

/**
 * PRD §11.4's Market sentence table. Some rows need context the engine's MarketState doesn't
 * itself carry (which extended sub-period it is, why a CLOSED session is closed, which auction
 * phase) — packages/calendars or the caller's own session-template knowledge has to supply it,
 * so those are optional parameters here with a defensible fallback rather than guessed text.
 */
export interface MarketSentenceContext {
  venue: string;
  venueGroup?: string;
  symbol: string;
  mic: Mic;
  state: MarketState;
  extendedPeriod?: "pre-market" | "after-hours" | "overnight";
  auctionPhase?: "opening" | "closing" | "pre-opening";
  closedReason?: "lunch" | "holiday";
  holidayName?: string;
  unknownSessionReason?: "awaiting attestation" | "closing-auction random end" | "status stale";
  haltFeedFamily?: string;
}

function resumptionClause(state: MarketState, mic: Mic): string {
  if (state.expectedResumption === 0) return "No resumption time yet";
  return `Resumes at ${formatVenueTime(state.expectedResumption, mic)}`;
}

export function marketSentence(ctx: MarketSentenceContext): string {
  const { state, venue, symbol, mic } = ctx;

  if (state.interruption === "UNKNOWN") {
    const family = ctx.haltFeedFamily ?? "venue's";
    const since = formatVenueTime(state.interruptionSince || state.sessionSince, mic);
    return `The ${family} halt feed has been unavailable since ${since}. Bellstate can't confirm ${symbol} isn't halted.`;
  }

  if (state.interruption === "VENUE_HALTED") {
    const group = ctx.venueGroup ?? venue;
    return `All trading on ${group} is halted: ${reasonText(state)}. ${resumptionClause(state, mic)}.`;
  }

  if (state.interruption === "ASSET_HALTED") {
    const at = formatVenueTime(state.interruptionSince, mic);
    return `${venue} halted ${symbol} at ${at}: ${reasonText(state)}. ${resumptionClause(state, mic)}.`;
  }

  if (state.interruption === "PRICE_CONSTRAINED") {
    return `${symbol} is trading at a price limit on ${venue}.`;
  }

  // interruption is NONE past this point — session drives the sentence.
  switch (state.session) {
    case "REGULAR":
      return `${venue} is open. ${symbol} is trading normally.`;
    case "EXTENDED": {
      const period = ctx.extendedPeriod ?? "extended-hours";
      return `${venue} ${period} session. Liquidity is thinner than regular hours.`;
    }
    case "AUCTION": {
      const phase = ctx.auctionPhase ?? "auction";
      const at = formatVenueTime(state.nextScheduledTransition, mic, false);
      return `${venue} ${phase} auction. Orders collect; the price sets at ${at}.`;
    }
    case "CLOSED": {
      if (ctx.closedReason === "lunch") return "HKEX lunch break until 13:00 HKT.";
      if (ctx.closedReason === "holiday") {
        const next = formatVenueTime(state.nextScheduledTransition, mic, false);
        return `${venue} is closed for ${ctx.holidayName ?? "a holiday"}. Next open ${next}.`;
      }
      const next = formatVenueTime(state.nextScheduledTransition, mic, false);
      return `${venue} is closed until ${next}. Onchain prices can move while the real market can't.`;
    }
    case "UNKNOWN": {
      const reason = ctx.unknownSessionReason ?? "status stale";
      return `Bellstate can't confirm ${venue}'s session right now: ${reason}.`;
    }
  }
}

/** PRD §11.4: "Reason text comes from App. B." reasonCategory is the fallback when no
 * per-code UI text is available to the caller (that table lives in packages/sources/*
 * currently, one per source, not centralized here). */
function reasonText(state: MarketState): string {
  return state.reasonCode !== "NONE" ? state.reasonCode : state.reasonCategory;
}

/** PRD §11.4: embed short forms, ≤ 40 chars. */
export function embedShortForm(ctx: MarketSentenceContext): string {
  const { state } = ctx;
  if (state.interruption === "ASSET_HALTED") return `Halted · ${reasonText(state)}`;
  if (state.interruption === "VENUE_HALTED") return "Halted · venue-wide";
  if (state.interruption === "UNKNOWN" || state.session === "UNKNOWN") return "Status unknown";
  if (state.session === "CLOSED") {
    if (ctx.closedReason === "lunch") return "Lunch · reopens 13:00 HKT";
    const next = formatVenueTime(state.nextScheduledTransition, ctx.mic, false);
    return `Closed · opens ${next}`;
  }
  if (state.session === "EXTENDED") {
    return ctx.extendedPeriod === "pre-market" ? "Pre-market" : "After-hours";
  }
  return "Open";
}
