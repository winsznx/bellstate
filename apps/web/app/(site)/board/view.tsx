"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  compareBySeverity,
  formatVenueTime,
  PROGRAM_LIFECYCLE_LABELS,
  PRIMARY_LEG_LABELS,
  VALUATION_LABELS,
  VALUATION_NOT_PROVIDED_LABEL,
} from "@winsznx/bellstate-ui";
import type { Mic } from "@winsznx/bellstate-calendars";
import { AssetIcon } from "../../_components/AssetIcon";
import { InterruptionChip, SessionChip } from "../../_components/StatusChip";
import { VenueTile } from "../../_components/VenueTile";
import type { BoardSnapshot } from "./data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function BoardView({ initial }: { initial: BoardSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [search, setSearch] = useState("");
  const [session, setSession] = useState("ALL");
  const [interruption, setInterruption] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "disconnected"
  >(url && key ? "connecting" : "disconnected");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setSearch(query.get("q") ?? "");
    setSession(query.get("session") ?? "ALL");
    setInterruption(query.get("interruption") ?? "ALL");
  }, []);
  const updateFilter = (
    name: "q" | "session" | "interruption",
    value: string,
  ) => {
    if (name === "q") setSearch(value);
    else if (name === "session") setSession(value);
    else setInterruption(value);
    const query = new URLSearchParams(window.location.search);
    if (!value || value === "ALL") query.delete(name);
    else query.set(name, value);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query.size ? `?${query}` : ""}`,
    );
  };

  useEffect(() => {
    if (!url || !key) return;
    const client = createClient(url, key);
    let mounted = true;
    let queued = false;
    const refresh = async () => {
      if (queued) return;
      queued = true;
      setRefreshing(true);
      try {
        const response = await fetch("/board/snapshot", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = (await response.json()) as BoardSnapshot;
        if (mounted) setSnapshot(next);
      } catch (error) {
        if (mounted)
          setSnapshot((current) => ({
            ...current,
            error: `Live update failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          }));
      } finally {
        queued = false;
        if (mounted) setRefreshing(false);
      }
    };
    const channel = client
      .channel("board-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_current" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "halt_events" },
        refresh,
      )
      .subscribe((status) => {
        if (!mounted) return;
        if (status === "SUBSCRIBED") {
          setConnection("connected");
          void refresh();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        )
          setConnection("disconnected");
      });
    return () => {
      mounted = false;
      void client.removeChannel(channel);
    };
  }, []);

  const rows = useMemo(
    () =>
      snapshot.rows
        .filter((row) => {
          const q = search.trim().toLowerCase();
          const match =
            !q ||
            [
              row.symbol,
              row.name,
              row.underlyingSymbol,
              row.isin,
              ...(row.tokenAddresses ?? []),
            ].some((value) => value?.toLowerCase().includes(q));
          return (
            match &&
            (session === "ALL" || row.market.session === session) &&
            (interruption === "ALL" || row.market.interruption === interruption)
          );
        })
        .sort((a, b) => compareBySeverity(a.market, b.market)),
    [snapshot.rows, search, session, interruption],
  );
  const counts = {
    REGULAR: 0,
    EXTENDED: 0,
    AUCTION: 0,
    CLOSED: 0,
    UNKNOWN: 0,
    halted: 0,
  };
  for (const row of snapshot.rows) {
    if (
      row.market.interruption === "ASSET_HALTED" ||
      row.market.interruption === "VENUE_HALTED"
    )
      counts.halted++;
    else counts[row.market.session]++;
  }
  const names = new Map(
    snapshot.rows.map((row) => [row.listingId, row.symbol]),
  );
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-ink">Board</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Real-market status of every tracked onchain stock.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Snapshot {new Date(snapshot.fetchedAt).toLocaleString()}
          {refreshing ? " · Updating…" : ""} · Live updates {connection}
        </p>
      </header>
      {snapshot.error && (
        <p
          role="alert"
          className="mb-6 rounded-control border border-status-halted px-4 py-3 text-sm text-status-halted"
        >
          {snapshot.error}
        </p>
      )}
      <section
        aria-label="Venues"
        className="mb-8 flex gap-4 overflow-x-auto pb-2"
      >
        {snapshot.venues.map((venue) => {
          const related = snapshot.rows.filter((row) => row.mic === venue.mic);
          const representative = related[0];
          return (
            <VenueTile
              key={venue.mic}
              mic={venue.mic as Mic}
              venueName={venue.venueName}
              session={representative?.market.session ?? "UNKNOWN"}
              nextTransition={
                representative?.market.nextScheduledTransition
                  ? formatVenueTime(
                      representative.market.nextScheduledTransition,
                      venue.mic as Mic,
                      false,
                    )
                  : "—"
              }
              openHalts={
                related.filter(
                  (row) => row.market.interruption === "ASSET_HALTED",
                ).length
              }
              sourceHealth="unknown"
            />
          );
        })}
      </section>
      <section
        aria-label="Summary"
        className="mb-8 flex flex-wrap gap-5 border-y border-border py-4 text-sm"
      >
        {(["REGULAR", "EXTENDED", "AUCTION", "CLOSED", "UNKNOWN"] as const).map(
          (key) => (
            <span key={key} className="text-ink-secondary">
              {key[0] + key.slice(1).toLowerCase()}{" "}
              <strong className="text-ink">{counts[key]}</strong>
            </span>
          ),
        )}
        <span className="text-status-halted">
          Open halts <strong>{counts.halted}</strong>
        </span>
      </section>
      <section aria-label="Filters" className="mb-4 flex flex-wrap gap-3">
        <input
          aria-label="Search assets"
          value={search}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search symbol, name, ISIN or token address"
          className="min-w-0 flex-1 rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted sm:max-w-md"
        />
        <select
          aria-label="Session"
          value={session}
          onChange={(event) => updateFilter("session", event.target.value)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="ALL">All sessions</option>
          {["REGULAR", "EXTENDED", "AUCTION", "CLOSED", "UNKNOWN"].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
        <select
          aria-label="Interruption"
          value={interruption}
          onChange={(event) => updateFilter("interruption", event.target.value)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="ALL">All interruptions</option>
          {[
            "NONE",
            "ASSET_HALTED",
            "VENUE_HALTED",
            "PRICE_CONSTRAINED",
            "UNKNOWN",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </section>
      <section aria-label="Assets" className="mb-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-2 pr-4">Symbol</th>
              <th className="py-2 pr-4">Reference listing</th>
              <th className="py-2 pr-4">Session</th>
              <th className="py-2 pr-4">Interruption</th>
              <th className="py-2 pr-4">Valuation</th>
              <th className="py-2 pr-4">Primary</th>
              <th className="py-2 pr-4">Program</th>
              <th className="py-2 pr-4">Next transition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.programId ?? row.symbol}
                className="border-b border-border hover:bg-surface-muted"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <AssetIcon symbol={row.symbol} size={36} />
                    <div>
                      <Link
                        href={`/asset/${encodeURIComponent(row.symbol)}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {row.symbol}
                      </Link>
                      <div className="text-xs text-ink-muted">{row.name}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-ink-secondary">
                  {row.mic}:{row.underlyingSymbol}
                </td>
                <td className="py-3 pr-4">
                  <SessionChip session={row.market.session} />
                </td>
                <td className="py-3 pr-4">
                  <InterruptionChip
                    interruption={row.market.interruption}
                    reasonText={
                      row.market.reasonCode !== "NONE"
                        ? row.market.reasonCode
                        : undefined
                    }
                  />
                </td>
                <td className="py-3 pr-4 text-ink-secondary">
                  {row.valuationCondition === "NOT_PROVIDED"
                    ? VALUATION_NOT_PROVIDED_LABEL
                    : VALUATION_LABELS[row.valuationCondition]}
                </td>
                <td className="py-3 pr-4 text-ink-secondary">
                  {PRIMARY_LEG_LABELS[row.primaryIssuance]}
                </td>
                <td className="py-3 pr-4 text-ink-secondary">
                  {PROGRAM_LIFECYCLE_LABELS[row.programLifecycle]}
                </td>
                <td className="py-3 pr-4 text-ink-muted">
                  {row.market.nextScheduledTransition
                    ? row.market.nextScheduledTransition * 1000 < Date.now()
                      ? "Awaiting attestation"
                      : formatVenueTime(
                          row.market.nextScheduledTransition,
                          row.mic as Mic,
                          false,
                        )
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!snapshot.error && rows.length === 0 && (
          <p className="py-8 text-sm text-ink-muted">
            {snapshot.rows.length
              ? "No assets match these filters."
              : "No tracked assets are available yet."}
          </p>
        )}
      </section>
      <section aria-label="Live feed">
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">
          Recent halt reports
        </h2>
        {snapshot.events.length ? (
          <ul className="divide-y divide-border">
            {snapshot.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
              >
                <span className="text-ink">
                  {names.get(event.listingId ?? undefined) ??
                    "Unmatched listing"}{" "}
                  {event.reason ?? "Halt reported"}
                </span>
                <a
                  href={event.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-secondary underline"
                >
                  {new Date(event.haltedAt).toLocaleString()}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No halt reports available.</p>
        )}
      </section>
    </main>
  );
}
