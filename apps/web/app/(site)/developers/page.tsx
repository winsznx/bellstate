import { EIP712_TYPES } from "@winsznx/bellstate-protocol";
import { INTERRUPTION_LABELS, SESSION_LABELS, VALUATION_LABELS, PRIMARY_LEG_LABELS } from "@winsznx/bellstate-ui";

// PRD §11.5 S10. The EIP-712 type strings below are the real ones from packages/protocol, not
// transcribed — the same source the signer and hub use. Addresses need deployments/196.json
// (doesn't exist — no hub deployed yet). API/x402/webhooks/Telegram/SDK sections need those
// services built first (none are). Changelog-from-BUILDLOG.md isn't wired up.

const QUICKSTART = `import { createPublicClient, http } from "viem";

const client = createPublicClient({ transport: http("https://rpc.xlayer.tech") });
const status = await client.readContract({
  address: "0x...", // adapter address, from deployments/196.json (not deployed yet)
  abi: [/* IReferenceMarketStatus */],
  functionName: "referenceMarketStatus",
});`;

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
        No hub is deployed yet — deployments/196.json doesn&apos;t exist. This section will list
        the hub, HaltGate, AdapterFactory and per-token adapter addresses once it does.
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

      <section aria-label="Not yet built" className="border-t border-border pt-6 text-sm text-ink-muted">
        Guards reference, API try-it, x402, webhooks, Telegram, SDK, run-a-signer and changelog
        sections need the API/aggregator/signer services and a deployed hub — not built yet.
      </section>
    </main>
  );
}
