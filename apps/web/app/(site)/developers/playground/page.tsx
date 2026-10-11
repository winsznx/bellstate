import { createPublicClient, http, parseAbi } from "viem";
import deployment from "../../../../../../deployments/xlayer-mainnet.json";

export const dynamic = "force-dynamic";

const statusAbi = parseAbi([
  "function referenceMarketStatus() view returns (uint8 session, uint8 interruption, uint64 sessionAsOf, uint64 interruptionAsOf, uint64 nextScheduledTransition, bytes32 marketId)",
]);
const guardAbi = parseAbi([
  "function canLiquidate(address token, uint8 profile) view returns (bool ok, uint8 reason, bytes32 digest)",
  "function maxLtvBps(address token, uint16 baseLtvBps) view returns (uint16)",
]);
const liquidationReasons = [
  "Allowed", "Sequencer down", "Sequencer grace period", "Status stale",
  "Program inactive", "Program suspended", "Market halted", "Status unknown",
  "Session excluded", "Valuation unavailable",
] as const;

const client = createPublicClient({ transport: http("https://rpc.xlayer.tech", { timeout: 5000 }) });

async function readStatus(adapter: `0x${string}`) {
  const block = await client.getBlockNumber();
  const status = await client.readContract({
    address: adapter,
    abi: statusAbi,
    functionName: "referenceMarketStatus",
    blockNumber: block,
  });
  return { block, status };
}

async function readLendingGuard(token: `0x${string}`, block: bigint) {
  const address = deployment.contracts.LendingGuard as `0x${string}`;
  const [liquidation, maxLtvBps] = await Promise.all([
    client.readContract({ address, abi: guardAbi, functionName: "canLiquidate", args: [token, 0], blockNumber: block }),
    client.readContract({ address, abi: guardAbi, functionName: "maxLtvBps", args: [token, 7500], blockNumber: block }),
  ]);
  return { liquidation, maxLtvBps };
}

export default async function PlaygroundPage() {
  const adapter = deployment.assets.NVDAx.wrappedAdapter as `0x${string}`;
  let result: Awaited<ReturnType<typeof readStatus>> | null = null;
  let lending: Awaited<ReturnType<typeof readLendingGuard>> | null = null;
  let error = false;

  try {
    result = await readStatus(adapter);
    try {
      lending = await readLendingGuard(deployment.assets.NVDAx.wrappedToken as `0x${string}`, result.block);
    } catch {
      // The market-status read still has value when a separate guard dependency is unavailable.
    }
  } catch {
    error = true;
  }

  return (
    <main className="mx-auto w-full max-w-[900px] px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Contract playground</h1>
      <p className="mt-3 max-w-[660px] text-sm leading-6 text-ink-secondary">
        Read the NVDAx wrapped adapter directly from X Layer mainnet. This view uses a single
        block for the call and refreshes when you reload the page.
      </p>

      <section aria-labelledby="read-heading" className="mt-8 rounded-panel border border-border bg-surface p-5 sm:p-6">
        <h2 id="read-heading" className="text-lg font-semibold text-ink">referenceMarketStatus()</h2>
        <p className="mt-2 break-all font-mono text-xs text-ink-secondary">{adapter}</p>
        {error || !result ? (
          <p role="status" className="mt-5 text-sm text-ink-secondary">
            The X Layer RPC did not return this read. Reload to try again; no transaction was sent.
          </p>
        ) : (
          <div className="mt-5">
            <p className="text-sm text-ink-secondary">Read at block {result.block.toString()}</p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Session enum", result.status[0].toString()],
                ["Interruption enum", result.status[1].toString()],
                ["Session as of", result.status[2].toString()],
                ["Interruption as of", result.status[3].toString()],
                ["Next scheduled transition", result.status[4].toString()],
                ["Market ID", result.status[5]],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 border-t border-border pt-3">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      <section aria-labelledby="guard-heading" className="mt-6 rounded-panel border border-border bg-surface p-5 sm:p-6">
        <h2 id="guard-heading" className="text-lg font-semibold tracking-tight text-ink">LendingGuard</h2>
        <p className="mt-2 text-sm text-ink-secondary">Read-only STRICT profile for wrapped NVDAx, with a 75% example base LTV. A blocked result is a contract policy decision at the displayed block.</p>
        {lending ? (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-muted">Can liquidate</dt><dd className="mt-1 text-ink">{lending.liquidation[0] ? "Yes" : "No"} · {liquidationReasons[lending.liquidation[1]] ?? `Reason ${lending.liquidation[1]}`}</dd></div>
            <div><dt className="text-ink-muted">Maximum LTV</dt><dd className="mt-1 text-ink">{(Number(lending.maxLtvBps) / 100).toFixed(2)}%</dd></div>
            <div className="sm:col-span-2"><dt className="text-ink-muted">Status digest</dt><dd className="mt-1 break-all font-mono text-xs text-ink">{lending.liquidation[2]}</dd></div>
          </dl>
        ) : <p className="mt-4 text-sm text-ink-muted">Guard read unavailable at this block.</p>}
      </section>

      <p className="mt-6 text-sm leading-6 text-ink-secondary">
        Additional adapter, hub and what-if calls need a validated input and result UI.
        They are not available in this playground yet.
      </p>
    </main>
  );
}
