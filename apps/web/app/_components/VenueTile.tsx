import { SESSION_LABELS } from "@winsznx/bellstate-ui";
import type { Session } from "@winsznx/bellstate-engine";

export type SourceHealth = "healthy" | "degraded" | "unknown";

const HEALTH_DOT_CLASS: Record<SourceHealth, string> = {
  healthy: "bg-status-regular",
  degraded: "bg-status-halted",
  unknown: "bg-status-unknown",
};
const HEALTH_LABEL: Record<SourceHealth, string> = {
  healthy: "source healthy",
  degraded: "source degraded",
  unknown: "source health unknown — no data",
};

/**
 * PRD §11.5 S01 region 1: "local clock and session label, countdown to next transition, open
 * halts today, source health dot." The clock/countdown are static here (server-rendered
 * fixture) — they'd tick client-side once this reads a real snapshot with Realtime attached.
 *
 * `sourceHealth` is a real tri-state, not a boolean: a venue with zero tracked programs has no
 * data to judge health from at all, which is a different, honest thing to show than "healthy" —
 * an earlier version of this collapsed both into a green dot, which was actively misleading.
 */
export function VenueTile({
  mic,
  venueName,
  session,
  nextTransition,
  openHalts,
  sourceHealth,
}: {
  mic: string;
  venueName: string;
  session: Session;
  nextTransition: string;
  openHalts: number;
  sourceHealth: SourceHealth;
}) {
  return (
    <div className="min-w-[180px] rounded-panel border border-border bg-surface p-4 shadow-elevated">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ink-muted">{mic}</span>
        <span className={`h-2 w-2 rounded-full ${HEALTH_DOT_CLASS[sourceHealth]}`} aria-label={HEALTH_LABEL[sourceHealth]} />
      </div>
      <div className="mt-1 text-base font-semibold text-ink">{venueName}</div>
      <div className="mt-2 text-sm text-ink-secondary">{SESSION_LABELS[session]}</div>
      <div className="mt-1 text-xs text-ink-muted">Next: {nextTransition}</div>
      {openHalts > 0 ? (
        <div className="mt-2 text-xs font-medium text-status-halted">
          {openHalts} open halt{openHalts === 1 ? "" : "s"} today
        </div>
      ) : null}
    </div>
  );
}
