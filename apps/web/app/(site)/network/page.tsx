import deployment from "../../../../../deployments/xlayer-mainnet.json";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPublicClient, formatEther, http } from "viem";
import { loadOnchainStatus } from "../lib/onchainStatus";

export const dynamic = "force-dynamic";

const services = [
  { name: "API", binding: "API", url: "https://bellstate-api.timjosh507.workers.dev/health" },
  { name: "Aggregator", binding: "AGGREGATOR", url: "https://bellstate-aggregator.timjosh507.workers.dev/health" },
  { name: "Notifier", binding: "NOTIFIER", url: "https://bellstate-notifier.timjosh507.workers.dev/health" },
  { name: "Watch", binding: "WATCH", url: "https://bellstate-watch.timjosh507.workers.dev/health" },
  { name: "Signer A", binding: "SIGNER_A", url: "https://signer-a.timjosh507.workers.dev/health" },
  { name: "Signer B", binding: "SIGNER_B", url: "https://signer-b.timjosh507.workers.dev/health" },
  { name: "Signer C", binding: "SIGNER_C", url: "https://signer-c.timjosh507.workers.dev/health" },
] as const;

const submitter = deployment.firstAttestation.submittedBy as `0x${string}`;
const xlayer = createPublicClient({ transport: http("https://rpc.xlayer.tech", { timeout: 5000 }) });

async function loadSubmitterBalance(): Promise<bigint | null> {
  try {
    return await xlayer.getBalance({ address: submitter });
  } catch {
    return null;
  }
}

function displayBalance(value: bigint): string {
  const amount = formatEther(value);
  const [whole, fraction = ""] = amount.split(".");
  return `${whole}.${fraction.padEnd(8, "0").slice(0, 8)} OKB`;
}

type HealthBinding = { fetch(request: Request): Promise<Response> };
function isHealthBinding(value: unknown): value is HealthBinding {
  return typeof value === "object" && value !== null && "fetch" in value && typeof value.fetch === "function";
}

async function checkService(service: (typeof services)[number]) {
  try {
    const binding: unknown = Reflect.get(getCloudflareContext().env, service.binding);
    if (!isHealthBinding(binding)) return { ...service, reachable: false, status: null };
    const response = await binding.fetch(new Request(service.url, { signal: AbortSignal.timeout(5000) }));
    return { ...service, reachable: response.ok, status: response.status };
  } catch {
    return { ...service, reachable: false, status: null };
  }
}

export default async function NetworkPage() {
  const [results, status, balance] = await Promise.all([
    Promise.all(services.map(checkService)),
    loadOnchainStatus(),
    loadSubmitterBalance(),
  ]);
  const effectiveStatus = status && !status.stale && !status.transitionExpired && status.session !== "UNKNOWN" && status.interruption !== "UNKNOWN";
  const lowReserve = balance !== null && balance < 1_000_000_000_000_000n;

  return (
    <main className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Network</h1>
      <p className="mt-3 max-w-[650px] text-sm leading-6 text-ink-secondary">
        Public service reachability and deployed X Layer configuration. Checks run when you load
        this page; an HTTP response alone does not prove that attestations are reaching the hub.
      </p>

      <section aria-labelledby="service-heading" className="mt-8">
        <h2 id="service-heading" className="text-lg font-semibold text-ink">Services</h2>
        <p className="mt-1 text-sm text-ink-secondary">Live HTTP health checks, with a five-second timeout.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((service) => (
            <li key={service.name} className="flex items-center justify-between gap-3 rounded-panel border border-border bg-surface px-4 py-4">
              <span className="font-medium text-ink">{service.name}</span>
              <span className={`text-xs font-medium ${service.reachable ? "text-emerald-700" : "text-rose-700"}`}>
                {service.reachable ? `HTTP ${service.status}` : service.status ? `HTTP ${service.status}` : "Unavailable"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="deployment-heading" className="mt-9 border-t border-border pt-6">
        <h2 id="deployment-heading" className="text-lg font-semibold text-ink">Onchain deployment</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">Network</dt><dd className="mt-1 text-ink">{deployment.network} · chain {deployment.chainId}</dd></div>
          <div><dt className="text-ink-muted">Signer quorum</dt><dd className="mt-1 text-ink">{deployment.quorum} of {deployment.signers.length} configured signers</dd></div>
          <div className="sm:col-span-2"><dt className="text-ink-muted">BellstateHub</dt><dd className="mt-1 break-all font-mono text-xs text-ink">{deployment.contracts.BellstateHub}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="telemetry-heading" className="mt-9 border-t border-border pt-6">
        <h2 id="telemetry-heading" className="text-lg font-semibold text-ink">Live onchain reads</h2>
        <p className="mt-1 text-sm text-ink-secondary">Read when this page loads. The status comes from the deployed NVDAx adapter through the Bellstate API; the balance comes directly from X Layer RPC.</p>
        <dl className="mt-4 grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">X Layer block</dt><dd className="mt-1 text-ink">{status ? `#${status.blockNumber.toLocaleString()} · ${status.blockTimestamp}` : "Status read unavailable"}</dd></div>
          <div><dt className="text-ink-muted">NVDAx effective status</dt><dd className={`mt-1 font-medium ${effectiveStatus ? "text-emerald-700" : "text-rose-700"}`}>{status ? `${status.session} / ${status.interruption}` : "Unavailable"}</dd></div>
          <div><dt className="text-ink-muted">Submitter gas balance</dt><dd className="mt-1 text-ink">{balance === null ? "RPC read unavailable" : displayBalance(balance)}</dd></div>
          <div><dt className="text-ink-muted">Status freshness</dt><dd className={`mt-1 font-medium ${effectiveStatus ? "text-emerald-700" : "text-rose-700"}`}>{!status ? "Unverified" : status.stale ? "Stale" : status.transitionExpired ? "Scheduled transition expired" : effectiveStatus ? "Current at read block" : "Unknown"}</dd></div>
        </dl>
        {status && !effectiveStatus && <p className="mt-4 text-sm text-rose-700">The adapter currently returns an unknown or expired state. HTTP health checks above do not mean fresh attestations are reaching the hub.</p>}
        {lowReserve && <p className="mt-2 text-sm text-amber-700">The submitter holds less than 0.001 OKB. Its gas reserve is low; new onchain updates may fail until it is funded.</p>}
        <p className="mt-4 text-xs leading-5 text-ink-muted">Submitter: <span className="break-all font-mono">{submitter}</span>. Heartbeat cadence, source health, latency, drift and incident feeds are not yet public.</p>
      </section>
    </main>
  );
}
