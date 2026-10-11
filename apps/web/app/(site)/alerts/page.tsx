import Link from "next/link";

const notificationTypes = ["Trading halt", "Trading resumed", "Market status", "Oracle warning"];

export default function AlertsPage() {
  return (
    <main className="mx-auto w-full max-w-[920px] px-5 py-8 sm:px-8 sm:py-10">
      <header className="border-b border-border pb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Alerts</h1>
        <p className="mt-3 max-w-[580px] text-sm leading-6 text-ink-secondary">
          Follow the changes that affect a market before you place a trade. Delivery setup is
          currently unavailable; you can still review market changes on the Board.
        </p>
        <Link
          href="/board"
          className="mt-5 inline-flex min-h-10 items-center rounded-control border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          View the Board
        </Link>
      </header>

      <div className="grid gap-5 py-7 md:grid-cols-2">
        <section aria-labelledby="telegram-title" className="rounded-panel border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="telegram-title" className="text-lg font-semibold text-ink">Telegram</h2>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-secondary">
              Setup unavailable
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-secondary">
            Telegram alerts will let you choose assets, venues and events, then link your chat
            through the Bellstate bot.
          </p>
          <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-ink-secondary">
            Chat linking is not connected yet. Starting the bot now will not create an alert
            subscription.
          </p>
        </section>

        <section aria-labelledby="webhooks-title" className="rounded-panel border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="webhooks-title" className="text-lg font-semibold text-ink">Webhooks</h2>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-secondary">
              Setup unavailable
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-secondary">
            Webhooks will send signed event payloads to your HTTPS endpoint. You will be able to
            manage subscriptions, send a test and inspect delivery results here.
          </p>
          <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-ink-secondary">
            Wallet sign-in and the subscription API are not connected yet. No webhook can be
            created from this page.
          </p>
        </section>
      </div>

      <section aria-labelledby="events-title" className="border-t border-border pt-6">
        <h2 id="events-title" className="text-sm font-semibold text-ink">Planned notifications</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          These event types will be selectable when delivery setup is available.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {notificationTypes.map((type) => (
            <li key={type} className="rounded-control border border-border px-3 py-2 text-sm text-ink-secondary">
              {type}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
