export interface NotifierFilters {
  types?: string[];
  symbols?: string[];
  mics?: string[];
  families?: string[];
}

export interface NotifierEventContext {
  type: string;
  symbol?: string;
  mic?: string;
  /** An event can belong to more than one program/family (e.g. multiple tokenized wrappers
   * tracking the same underlying listing), unlike apps/api/src/filters.ts's single `family` on
   * a webhook-test event context. */
  families?: string[];
}

/**
 * PRD §10.5: "Filters: {types, symbols, mics, families}. Empty means all." Mirrors
 * apps/api/src/filters.ts's `matchesFilters` (every non-empty group applies as AND; an unset or
 * empty group always passes), adapted for `families` being a list on the event side: a
 * subscription's `families` filter matches if it shares at least one entry with the event's.
 */
export function matchesFilters(filters: NotifierFilters, event: NotifierEventContext): boolean {
  if (filters.types?.length && !filters.types.includes(event.type)) return false;
  if (filters.symbols?.length && (!event.symbol || !filters.symbols.includes(event.symbol))) return false;
  if (filters.mics?.length && (!event.mic || !filters.mics.includes(event.mic))) return false;
  if (filters.families?.length) {
    const eventFamilies = event.families ?? [];
    if (!eventFamilies.some((family) => filters.families!.includes(family))) return false;
  }
  return true;
}
