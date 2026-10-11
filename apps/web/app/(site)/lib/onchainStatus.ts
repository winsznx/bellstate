import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface OnchainStatus {
  symbol: "NVDAx";
  session: "UNKNOWN" | "REGULAR" | "EXTENDED" | "AUCTION" | "CLOSED";
  interruption: "UNKNOWN" | "NONE" | "PRICE_CONSTRAINED" | "ASSET_HALTED" | "VENUE_HALTED";
  sessionAsOfUnix: number;
  interruptionAsOfUnix: number;
  nextScheduledTransitionUnix: number;
  blockNumber: number;
  blockTimestamp: string;
  stale: boolean;
  transitionExpired: boolean;
  adapter: string;
  source: "onchain";
}

type ServiceBinding = { fetch(request: Request): Promise<Response> };

export async function loadOnchainStatus(): Promise<OnchainStatus | null> {
  try {
    const binding: unknown = Reflect.get(getCloudflareContext().env, "API");
    if (!binding || typeof binding !== "object" || !("fetch" in binding) || typeof binding.fetch !== "function") return null;
    const response = await (binding as ServiceBinding).fetch(new Request(
      "https://bellstate-api.timjosh507.workers.dev/v1/status/NVDAx",
      { signal: AbortSignal.timeout(6000) },
    ));
    if (!response.ok) return null;
    const body = await response.json() as OnchainStatus;
    if (body.source !== "onchain" || body.symbol !== "NVDAx") return null;
    return body;
  } catch {
    return null;
  }
}
