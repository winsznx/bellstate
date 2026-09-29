import Link from "next/link";

/**
 * Bellstate's marketing landing page — structurally modeled on the real marketing page this
 * project's owner pointed at (eyebrow badge → headline → hero visual with a gradient stage panel
 * → steps → feature grid with one gradient-filled card → integrations/sources strip → FAQ →
 * final CTA → footer), with Bellstate's own copy throughout. Not the PRD's own content (the PRD
 * has no marketing page at all — see layout.tsx) but grounded in real facts already established
 * elsewhere in this codebase (BUILDLOG.md, the PRD itself), not invented claims.
 */

const STEPS = [
  {
    n: "01",
    title: "Attest, don't estimate",
    body: "Three independent signers read Nasdaq, NYSE, HKEXnews and issuer feeds directly. A status only ships once two of three agree and sign it.",
  },
  {
    n: "02",
    title: "Write it onchain",
    body: "Every attested change lands in a hub contract on X Layer, with the EIP-712 signatures, the source reference, and the exact latency from source to chain.",
  },
  {
    n: "03",
    title: "Read it back",
    body: "A halt, a resumption, an issuer pause — every joint reading is a real, provable fact your contracts and your users can check for themselves.",
  },
];

const FEATURES = [
  {
    title: "Real halt sources, not a price feed",
    body: "Nasdaq RSS, NYSE JSON, HKEXnews, KIND. Bellstate parses what venues actually publish, with the format quirks and edge cases a real feed has.",
    gradient: false,
  },
  {
    title: "Quorum-signed, onchain",
    body: "Three signers, 2-of-3 quorum, EIP-712 attestations written to a hub contract. Nothing here is a single trusted API.",
    gradient: true,
  },
  {
    title: "A guard for every risk",
    body: "HaltGate blocks swaps during an attested halt. LendingGuard blocks liquidation on stale or unknown status. Both are pure, tested, onchain policy.",
    gradient: false,
  },
];

const FAQS = [
  {
    q: "What does Bellstate actually observe?",
    a: "Scheduled sessions, single-stock and market-wide halts, issuer program pauses and primary mint/redeem windows for US, HK and KR listings — each with a documented per-market coverage gap (see /method).",
  },
  {
    q: "Why three signers instead of one API?",
    a: "One source going down or lying shouldn't take the whole system down with it. A status only ships once 2 of 3 independent signers, each polling the real source themselves, sign the same attestation.",
  },
  {
    q: "What happens when a source is stale?",
    a: "The affected facet reports UNKNOWN rather than guessing. The PRD's own rule: a wrong transition time is worse than none.",
  },
  {
    q: "Is this a price oracle?",
    a: "No. Bellstate attests market status (open/closed/halted), not price. Valuation streams are read from designated Chainlink feeds where an issuer provides one.",
  },
];

export default function WelcomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-pill border border-border px-3 py-1 text-xs text-ink-secondary">
          <span aria-hidden>✳</span> Attested · Signed · Onchain
        </span>
        <h1 className="mx-auto max-w-[820px] text-display-l font-semibold text-ink sm:text-display-xl">
          The real market, attested onchain.
        </h1>
        <p className="mx-auto mt-5 max-w-[620px] text-body-l text-ink-secondary">
          Onchain stocks trade 24/7. Their real markets don&apos;t. Bellstate is the layer that
          tells your contracts — and your users — exactly what the real venue is doing right now,
          signed by independent parties, not a single API.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-control bg-brand px-5 text-sm font-medium text-white hover:bg-brand-strong"
          >
            View the Board
          </Link>
          <a
            href="#how"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-control border border-border px-5 text-sm font-medium text-ink hover:border-border-strong"
          >
            See how it works <span aria-hidden>▷</span>
          </a>
        </div>

        {/* Hero visual: two panels, one neutral with floating cards, one a gradient stage */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-card bg-surface-muted p-8 text-left">
            <div className="mb-3 flex items-center justify-between rounded-panel bg-white p-4 shadow-card">
              <div>
                <strong className="block text-sm text-ink">Nasdaq halted CTNTx</strong>
                <span className="text-xs text-ink-muted">News pending (T1) · 2 of 3 signers</span>
              </div>
              <span className="rounded-pill bg-close-soft px-2.5 py-1 text-xs font-medium text-close">
                Halted
              </span>
            </div>
            <div className="flex items-center justify-between rounded-panel bg-white p-4 shadow-card">
              <div>
                <strong className="block text-sm text-ink">NVDAx resumed</strong>
                <span className="text-xs text-ink-muted">Nasdaq · 04:15 ET</span>
              </div>
              <span className="rounded-pill bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                Regular
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-card bg-hero-panel p-8 text-left">
            <div className="rounded-panel bg-white/90 p-4 shadow-floating backdrop-blur">
              <strong className="block text-sm text-ink">Quorum reached</strong>
              <div className="my-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted">
                <span className="block h-full w-2/3 rounded-pill bg-accent" />
              </div>
              <p className="flex justify-between text-xs text-ink-secondary">
                <span>2 of 3 signers confirmed</span>
                <b className="text-ink">24s to chain</b>
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="rounded-pill bg-white/80 px-3 py-1 text-xs font-medium text-ink">Nasdaq RSS</span>
              <span className="rounded-pill bg-white/80 px-3 py-1 text-xs font-medium text-ink">HKEXnews</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-[1200px] px-6 py-24">
        <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-ink-muted">
          How a status becomes fact
        </span>
        <h2 className="max-w-[520px] text-h1 font-semibold text-ink">
          From a real feed to a signed, onchain attestation.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n}>
              <span className="mb-3 block text-xs font-mono text-ink-muted">{step.n}</span>
              <h3 className="mb-2 text-h3 font-semibold text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-ink-secondary">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section id="coverage" className="mx-auto max-w-[1200px] px-6 py-24">
        <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-ink-muted">
          Coverage
        </span>
        <h2 className="max-w-[560px] text-h1 font-semibold text-ink">
          Everything an onchain guard actually needs to know.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`rounded-card p-6 ${f.gradient ? "bg-accent-deep text-white" : "border border-border"}`}
            >
              <h3 className={`mb-2 text-h3 font-semibold ${f.gradient ? "text-white" : "text-ink"}`}>{f.title}</h3>
              <p className={`text-sm leading-relaxed ${f.gradient ? "text-white/80" : "text-ink-secondary"}`}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources strip */}
      <section id="sources" className="border-y border-border bg-surface-muted py-16">
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <p className="mb-8 text-sm text-ink-secondary">Real sources, parsed directly — not a data reseller.</p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-medium text-ink-secondary">
            <span>Nasdaq Trade Halt RSS</span>
            <span>NYSE Trade Halts</span>
            <span>HKEXnews</span>
            <span>xStocks API</span>
            <span>Chainlink Data Streams</span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-ink-muted">Questions</span>
        <h2 className="mb-12 text-h1 font-semibold text-ink">Good questions, clear answers.</h2>
        <div className="mx-auto max-w-[720px] divide-y divide-border">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                {faq.q}
                <span className="text-ink-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="rounded-card bg-surface-muted px-8 py-16 text-center">
          <h2 className="mx-auto max-w-[520px] text-h1 font-semibold text-ink">
            The real market's status, one honest read away.
          </h2>
          <p className="mx-auto mt-3 max-w-[440px] text-sm text-ink-secondary">
            No sign-up. The Board is public, live, and reads the same attestations your contracts
            would.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-control bg-brand px-5 text-sm font-medium text-white hover:bg-brand-strong"
          >
            Open the Board
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
          <div>
            <div className="mb-3 text-sm font-semibold text-ink">Bellstate</div>
            <p className="text-xs text-ink-muted">Real-market status for onchain stocks.</p>
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Product</div>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li><Link href="/" className="hover:text-ink">Board</Link></li>
              <li><Link href="/watch" className="hover:text-ink">Oracle Watch</Link></li>
              <li><Link href="/replay" className="hover:text-ink">Replays</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Developers</div>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li><Link href="/developers" className="hover:text-ink">Docs</Link></li>
              <li><Link href="/developers/playground" className="hover:text-ink">Playground</Link></li>
              <li><Link href="/method" className="hover:text-ink">Methodology</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Network</div>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li><Link href="/network" className="hover:text-ink">Network health</Link></li>
              <li><Link href="/alerts" className="hover:text-ink">Alerts</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
}
