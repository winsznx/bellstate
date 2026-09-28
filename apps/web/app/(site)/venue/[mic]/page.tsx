import { notFound } from "next/navigation";
import type { Mic } from "@winsznx/bellstate-calendars";
import { dayWindows, resolveSessionWindow, TIMEZONE_BY_MIC, upcomingSpecialDays } from "@winsznx/bellstate-calendars";
import { formatVenueTime, SESSION_LABELS } from "@winsznx/bellstate-ui";
import Link from "next/link";
import { SessionChip } from "../../../_components/StatusChip";
import { haltsTodayFor, sourceHealthyFor } from "./fixtures";
import { supabaseServerClient } from "../../lib/supabase";

// PRD §11.5 S03. Regions 1-3 (clock/session, today's session bar, special days) are computed
// live from packages/calendars — genuinely real, not fixture data. The venue display name is
// read live from Supabase's seeded `venues` table (scripts/seed/venues.sql), falling back to
// this map if Supabase isn't configured. Regions 4-6 (halts today, source health, cross-check
// drift) need live source polling, fixture-backed for now.

const VENUE_NAMES: Record<Mic, string> = {
  XNAS: "Nasdaq",
  XNYS: "NYSE",
  ARCX: "NYSE Arca",
  XASE: "NYSE American",
  XHKG: "HKEX",
  XKRX: "Korea Exchange",
  NXTE: "Nextrade",
};

const SESSION_WIDTH_CLASS: Record<string, string> = {
  REGULAR: "bg-status-regular",
  EXTENDED: "bg-status-extended",
  AUCTION: "bg-status-auction",
  CLOSED: "bg-status-closed",
  UNKNOWN: "bg-status-unknown",
};

export default async function VenuePage({ params }: { params: Promise<{ mic: string }> }) {
  const { mic: rawMic } = await params;
  const mic = rawMic.toUpperCase() as Mic;
  if (!(mic in VENUE_NAMES)) notFound();

  const venueName = await loadVenueName(mic);
  const now = Math.floor(Date.now() / 1000);
  const current = resolveSessionWindow(mic, now);
  const windows = dayWindows(mic, now);
  const specialDays = upcomingSpecialDays(mic, now, 60);
  const halts = haltsTodayFor(mic);
  const sourceHealthy = sourceHealthyFor(mic);

  const isHalfDayToday = specialDays.some((d) => d.type === "half" && isSameDay(d.dateKey, mic, now));
  const isHolidayToday = specialDays.some((d) => d.type === "closed" && isSameDay(d.dateKey, mic, now));

  const dayStart = windows[0]!.sessionSince;
  const dayLength = 86_400;

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <header className="mb-6 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-wide text-ink-muted">{mic}</div>
        <h1 className="mt-1 text-3xl font-semibold text-ink">{venueName}</h1>
        <div className="mt-3 flex items-center gap-4">
          <SessionChip session={current.session} />
          <span className="text-sm text-ink-muted">
            Next transition: {formatVenueTime(current.nextScheduledTransition, mic, false)}
          </span>
        </div>
        {isHolidayToday ? (
          <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-secondary">Closed today — holiday</p>
        ) : null}
        {isHalfDayToday && !isHolidayToday ? (
          <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-sm text-ink-secondary">
            Early close {formatVenueTime(windows.find((w) => w.session !== "CLOSED")?.nextScheduledTransition ?? now, mic, false)}
          </p>
        ) : null}
        {!sourceHealthy ? (
          <p className="mt-3 rounded-control bg-close-soft px-3 py-2 text-sm text-close">Halt source unreachable</p>
        ) : null}
      </header>

      {/* Region 2: today's session bar */}
      <section aria-label="Today" className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Today</h2>
        <div className="relative flex h-8 w-full overflow-hidden rounded-control border border-border">
          {windows.map((w, i) => {
            const widthPct = ((w.nextScheduledTransition - w.sessionSince) / dayLength) * 100;
            return (
              <div
                key={i}
                className={`h-full ${SESSION_WIDTH_CLASS[w.session]} ${w.session === "UNKNOWN" ? "opacity-60" : ""}`}
                style={{ width: `${widthPct}%` }}
                title={`${SESSION_LABELS[w.session]} · ${formatVenueTime(w.sessionSince, mic, false)}–${formatVenueTime(w.nextScheduledTransition, mic, false)}`}
              />
            );
          })}
          <div
            className="absolute top-0 h-full w-0.5 bg-ink"
            style={{ left: `${((now - dayStart) / dayLength) * 100}%` }}
            aria-label="now"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-muted">
          {Object.entries(SESSION_LABELS).map(([session, label]) => (
            <span key={session} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${SESSION_WIDTH_CLASS[session]}`} />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Region 3: special days */}
      <section aria-label="Special days" className="mb-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Special days (next 60 days)
        </h2>
        {specialDays.length === 0 ? (
          <p className="text-sm text-ink-muted">None scheduled.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {specialDays.map((d) => (
              <li key={d.dateKey} className="flex items-center gap-3">
                <span className="font-mono text-xs text-ink-muted">{d.dateKey}</span>
                <span className="text-ink-secondary">{d.type === "closed" ? "Closed" : "Early close"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Region 4: halts today */}
      <section aria-label="Halts today" className="mb-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Halts today</h2>
        {halts.length === 0 ? (
          <p className="text-sm text-ink-muted">No halts today.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {halts.map((h) => (
              <li key={h.symbol} className="flex items-center justify-between border-b border-border pb-2">
                <span>
                  {h.tracked ? (
                    <Link href={`/asset/${h.symbol}x`} className="font-medium text-brand underline">
                      {h.symbol}
                    </Link>
                  ) : (
                    <span className="text-ink-secondary">{h.symbol}</span>
                  )}
                  <span className="ml-2 text-ink-muted">{h.reasonCode}</span>
                </span>
                <span className="text-xs text-ink-muted">{formatVenueTime(h.haltAt, mic)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-border pt-6 text-sm text-ink-muted">
        Timezone: {TIMEZONE_BY_MIC[mic]}. Cross-check drift status not built yet (needs live
        cross-check data, §4.8).
      </section>
    </main>
  );
}

async function loadVenueName(mic: Mic): Promise<string> {
  const supabase = supabaseServerClient();
  if (!supabase) return VENUE_NAMES[mic];
  const { data, error } = await supabase.from("venues").select("name").eq("mic", mic).maybeSingle();
  if (error || !data) return VENUE_NAMES[mic];
  return data.name as string;
}

function isSameDay(dateKey: string, mic: Mic, unixSeconds: number): boolean {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE_BY_MIC[mic] });
  return formatter.format(new Date(unixSeconds * 1000)) === dateKey;
}
