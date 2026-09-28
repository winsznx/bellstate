import type { Interruption, Session } from "@winsznx/bellstate-engine";
import { INTERRUPTION_LABELS, SESSION_LABELS } from "@winsznx/bellstate-ui";

// Full class names written out (not template-interpolated) so Tailwind's content scanner can
// find them — a `${dotClass}` template string would silently produce no CSS at build time.
const SESSION_DOT_CLASS: Record<Session, string> = {
  REGULAR: "bg-status-regular",
  EXTENDED: "bg-status-extended",
  AUCTION: "bg-status-auction",
  CLOSED: "bg-status-closed",
  UNKNOWN: "bg-status-unknown",
};

const INTERRUPTION_DOT_CLASS: Record<Interruption, string> = {
  NONE: "bg-status-regular",
  PRICE_CONSTRAINED: "bg-status-price-limited",
  ASSET_HALTED: "bg-status-halted",
  VENUE_HALTED: "bg-status-venue-halted",
  UNKNOWN: "bg-status-unknown",
};

/**
 * PRD §11.3: "Every enum shows as text; color never carries meaning alone." The label always
 * renders regardless of color support; the dot is decorative reinforcement only.
 */
export function SessionChip({ session }: { session: Session }) {
  const dotClass = SESSION_DOT_CLASS[session];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-secondary">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      {SESSION_LABELS[session]}
    </span>
  );
}

export function InterruptionChip({
  interruption,
  reasonText,
}: {
  interruption: Interruption;
  reasonText?: string;
}) {
  const dotClass = INTERRUPTION_DOT_CLASS[interruption];
  const isDashed = interruption === "UNKNOWN";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-control border px-2 py-0.5 text-sm ${
        isDashed ? "border-dashed" : "border-solid"
      } border-border-strong text-ink-secondary`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      {INTERRUPTION_LABELS[interruption]}
      {reasonText && interruption !== "NONE" ? <span className="text-ink-muted">· {reasonText}</span> : null}
    </span>
  );
}
