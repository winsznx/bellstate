export interface WebhookFilters {
  types?: string[];
  symbols?: string[];
  mics?: string[];
  families?: string[];
}

export interface EventContext {
  type: string;
  symbol?: string;
  mic?: string;
  family?: string;
}

/** PRD §10.5: "Filters: {types, symbols, mics, families}. Empty means all." Every non-empty
 * group must match (AND across groups); an unset/empty group always passes. */
export function matchesFilters(filters: WebhookFilters, event: EventContext): boolean {
  if (filters.types?.length && !filters.types.includes(event.type)) return false;
  if (filters.symbols?.length && (!event.symbol || !filters.symbols.includes(event.symbol))) return false;
  if (filters.mics?.length && (!event.mic || !filters.mics.includes(event.mic))) return false;
  if (filters.families?.length && (!event.family || !filters.families.includes(event.family))) return false;
  return true;
}
