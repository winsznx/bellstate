/** PRD §4.5: "Use exchange.mic when present ... Otherwise map by exchange name with an explicit
 * table ... An unmapped name blocks registration." */
const EXCHANGE_NAME_TO_MIC: Record<string, string> = {
  HKEX: "XHKG",
  "Nasdaq Stock Market": "XNAS",
  "New York Stock Exchange": "XNYS",
};

export class UnmappedExchangeError extends Error {
  constructor(public readonly exchangeName: string) {
    super(`no MIC mapping for exchange "${exchangeName}" — registration must be blocked (§4.5)`);
  }
}

export function exchangeToMic(exchange: { mic: string | null; name: string } | null): string {
  if (!exchange) throw new UnmappedExchangeError("(no exchange object)");
  if (exchange.mic) return exchange.mic;
  const mapped = EXCHANGE_NAME_TO_MIC[exchange.name];
  if (!mapped) throw new UnmappedExchangeError(exchange.name);
  return mapped;
}
