import type { StatusUpdateEvent } from "./decodeHubLog.js";

export type DomainEventName =
  | "status.market.changed"
  | "halt.opened"
  | "halt.resumed"
  | "status.program.changed"
  | "status.primary.changed"
  | "status.valuation.changed";

export interface DomainEvent {
  name: DomainEventName;
  subjectId: `0x${string}`;
}

const INTERRUPTION_ASSET_HALTED = 3;
const INTERRUPTION_VENUE_HALTED = 4;

function isHalted(interruption: number): boolean {
  return interruption === INTERRUPTION_ASSET_HALTED || interruption === INTERRUPTION_VENUE_HALTED;
}

/**
 * PRD §8.3: "Publishes domain events to Queue bellstate-events." `priorInterruption` is the
 * interruption value `status_current` held for this listing before this update (undefined for a
 * listing's first-ever MarketUpdated, which per §3.3's determinism rules can itself open a halt
 * — e.g. a signer's first tick after startup observing an already-open halt).
 */
export function deriveDomainEvents(event: StatusUpdateEvent, priorInterruption?: number): DomainEvent[] {
  switch (event.eventName) {
    case "MarketUpdated": {
      const events: DomainEvent[] = [{ name: "status.market.changed", subjectId: event.args.listingId }];
      const wasHalted = priorInterruption !== undefined && isHalted(priorInterruption);
      const nowHalted = isHalted(event.args.interruption);
      if (!wasHalted && nowHalted) {
        events.push({ name: "halt.opened", subjectId: event.args.listingId });
      } else if (wasHalted && !nowHalted) {
        events.push({ name: "halt.resumed", subjectId: event.args.listingId });
      }
      return events;
    }
    case "ProgramUpdated":
      return [{ name: "status.program.changed", subjectId: event.args.programId }];
    case "PrimaryUpdated":
      return [{ name: "status.primary.changed", subjectId: event.args.programId }];
    case "ValuationUpdated":
      return [{ name: "status.valuation.changed", subjectId: event.args.programId }];
  }
}
