import { EIP712_TYPES } from "@winsznx/bellstate-protocol";
import { INTERRUPTION_LABELS, SESSION_LABELS, VALUATION_LABELS, PRIMARY_LEG_LABELS } from "@winsznx/bellstate-ui";
import deployment from "../../../../../deployments/xlayer-mainnet.json";

// PRD §11.5 S10. Types and deployed addresses come from their checked-in sources of truth.

const QUICKSTART = `import { createPublicClient, http, parseAbi } from "viem";

const client = createPublicClient({ transport: http("https://rpc.xlayer.tech") });
const status = await client.readContract({
  address: "${deployment.assets.NVDAx.wrappedAdapter}",
  abi: parseAbi(["function referenceMarketStatus() view returns (uint8 session, uint8 interruption, uint64 sessionAsOf, uint64 interruptionAsOf, uint64 nextScheduledTransition, bytes32 marketId)"]),
  functionName: "referenceMarketStatus",
});
console.log(status); // UNKNOWN (0) is expected while attestations are stale`;

const ADDRESSES = [
  ["BellstateHub", deployment.contracts.BellstateHub],
  ["HaltGateHook", deployment.contracts.HaltGateHook],
  ["AdapterFactory", deployment.contracts.AdapterFactory],
  ["NVDAx wrapped adapter", deployment.assets.NVDAx.wrappedAdapter],
  ["NVDAx raw adapter", deployment.assets.NVDAx.rawAdapter],
] as const;

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold text-ink">Developers</h1>

      <section aria-label="Quickstart" className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Quickstart</h2>
        <pre className="overflow-x-auto rounded-panel border border-border bg-surface-muted p-4 font-mono text-xs text-ink">
          {QUICKSTART}
        </pre>
      </section>

      <section aria-label="Addresses" className="mb-10 text-sm text-ink-muted">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Addresses</h2>
        <p className="mb-3">Verified X Layer mainnet deployment (chain {deployment.chainId}). NVDAx is the first registered asset.</p>
        <dl className="space-y-2">
          {ADDRESSES.map(([label, address]) => (
            <div key={label}><dt className="font-medium text-ink">{label}</dt><dd className="break-all font-mono text-xs">{address}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-label="ERC-8392 reference" className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          ERC-8392 reference
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <div className="mb-1 text-xs text-ink-muted">Session</div>
            {Object.values(SESSION_LABELS).map((l) => (
              <div key={l} className="text-ink-secondary">{l}</div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-muted">Interruption</div>
            {Object.values(INTERRUPTION_LABELS).map((l) => (
              <div key={l} className="text-ink-secondary">{l}</div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-muted">Valuation</div>
            {Object.values(VALUATION_LABELS).map((l) => (
              <div key={l} className="text-ink-secondary">{l}</div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-muted">Primary</div>
            {Object.values(PRIMARY_LEG_LABELS).map((l) => (
              <div key={l} className="text-ink-secondary">{l}</div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="EIP-712 message types" className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          EIP-712 message types
        </h2>
        <p className="mb-2 text-sm text-ink-secondary">
          Signed by every signer, verified by the hub (§6.2) — field lists straight from
          packages/protocol, not transcribed.
        </p>
        {Object.entries(EIP712_TYPES).map(([name, fields]) => (
          <div key={name} className="mb-3">
            <div className="font-mono text-xs font-semibold text-ink">{name}</div>
            <div className="font-mono text-xs text-ink-muted">
              {fields.map((f) => `${f.type} ${f.name}`).join(", ")}
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Availability" className="border-t border-border pt-6 text-sm text-ink-muted">
        The contract playground reads the live NVDAx adapter and LendingGuard. The free Print Check preview runs local calendar and policy rules. Paid x402 checks, alert management, SDK quickstarts and a changelog are still being connected.
      </section>
    </main>
  );
}
