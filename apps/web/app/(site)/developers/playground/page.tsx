import { createPublicClient, http, parseAbi } from "viem";
import deployment from "../../../../../../deployments/xlayer-mainnet.json";

export const dynamic = "force-dynamic";

const statusAbi = parseAbi([
  "function referenceMarketStatus() view returns (uint8 session, uint8 interruption, uint64 sessionAsOf, uint64 interruptionAsOf, uint64 nextScheduledTransition, bytes32 marketId)",
]);

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

export default async function PlaygroundPage() {
  const adapter = deployment.assets.NVDAx.wrappedAdapter as `0x${string}`;
  let result: Awaited<ReturnType<typeof readStatus>> | null = null;
  let error = false;

  try {
    result = await readStatus(adapter);
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

      <p className="mt-6 text-sm leading-6 text-ink-secondary">
        Additional adapter, guard, hub and what-if calls need a validated input and result UI.
        They are not available in this playground yet.
      </p>
    </main>
  );
}
