"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
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
import type { BoardQuery, BoardSnapshot } from "./data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const artworkCatalog = [
  { symbol: "NVDAx", artwork: "Token artwork" },
  { symbol: "SKHYx", artwork: "Token artwork" },
  { symbol: "TCENTx", artwork: "Token artwork" },
  { symbol: "CTNTx", artwork: "Company artwork" },
] as const;

export function BoardView({ initial, initialQuery }: { initial: BoardSnapshot; initialQuery: BoardQuery }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [search, setSearch] = useState(initialQuery.q ?? "");
  const [session, setSession] = useState(initialQuery.session ?? "ALL");
  const [interruption, setInterruption] = useState(initialQuery.interruption ?? "ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(initial.page);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const firstRender = useRef(true);
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "disconnected"
  >(url && key ? "connecting" : "disconnected");

  const updateFilter = (
    name: "q" | "session" | "interruption",
    value: string,
  ) => {
    setPage(1);
    if (name === "q") setSearch(value);
    else if (name === "session") setSession(value);
    else setInterruption(value);
    const query = new URLSearchParams(window.location.search);
    if (!value || value === "ALL") query.delete(name);
    else query.set(name, value);
    query.delete("page");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query.size ? `?${query}` : ""}`,
    );
  };

  const changePage = (next: number) => {
    setPage(next);
    const query = new URLSearchParams(window.location.search);
    query.set("page", String(next));
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRefreshing(true);
      try {
        const query = new URLSearchParams();
        if (search.trim()) query.set("q", search.trim());
        if (session !== "ALL") query.set("session", session);
        if (interruption !== "ALL") query.set("interruption", interruption);
        query.set("page", String(page));
        const response = await fetch(`/board/snapshot?${query}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = (await response.json()) as BoardSnapshot;
        if (!controller.signal.aborted) setSnapshot(next);
      } catch (error) {
        if (!controller.signal.aborted) setSnapshot((current) => ({
          ...current,
          error: `Live update failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        }));
      } finally {
        if (!controller.signal.aborted) setRefreshing(false);
      }
    }, refreshNonce ? 0 : 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, session, interruption, page, refreshNonce]);

  useEffect(() => {
    if (!url || !key) return;
    const client = createClient(url, key);
    let mounted = true;
    const refresh = () => setRefreshNonce((value) => value + 1);
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
          refresh();
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

  const visibleRows = snapshot.rows;
  const pageSize = snapshot.pageSize;
  const pageCount = Math.max(1, Math.ceil(snapshot.filteredRows / pageSize));
  const counts = snapshot.counts;
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-ink">Board</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          X Layer xStocks from the issuer catalog, with attested status where available.
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
          return (
            <VenueTile
              key={venue.mic}
              mic={venue.mic as Mic}
              venueName={venue.venueName}
              session={venue.calendarSession}
              nextTransition={
                venue.nextTransition
                  ? formatVenueTime(
                      venue.nextTransition,
                      venue.mic as Mic,
                      false,
                    )
                  : "—"
              }
              openHalts={venue.openHalts ?? 0}
              sourceHealth="unknown"
            />
          );
        })}
      </section>
      <p className="mb-5 text-xs text-ink-muted">Venue tiles show the computed calendar session, not an attestation. Asset sessions below require indexed status.</p>
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
            {visibleRows.map((row) => (
              <tr
                key={row.programId ?? row.symbol}
                className="border-b border-border hover:bg-surface-muted"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <AssetIcon symbol={row.symbol} issuerLogo={row.logo} size={36} />
                    <div>
                      <Link
                        href={`/asset/${encodeURIComponent(row.symbol)}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {row.symbol}
                      </Link>
                      <div className="text-xs text-ink-muted">{row.name}</div>
                      <div className="text-xs text-ink-muted">{row.statusSource === "onchain" ? "Onchain adapter" : row.statusSource === "indexed" ? "Indexed attestation" : "Issuer catalog · status unavailable"}</div>
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
        {!snapshot.error && snapshot.filteredRows === 0 && (
          <p className="py-8 text-sm text-ink-muted">
            {snapshot.totalRows
              ? "No assets match these filters."
              : "The issuer catalog is unavailable right now."}
          </p>
        )}
      </section>
      {snapshot.filteredRows > pageSize && <nav aria-label="Asset pages" className="mb-8 flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-muted">Showing {(snapshot.page - 1) * pageSize + 1}–{Math.min(snapshot.page * pageSize, snapshot.filteredRows)} of {snapshot.filteredRows} assets</span>
        <div className="flex items-center gap-3">
          <button type="button" disabled={snapshot.page <= 1} onClick={() => changePage(snapshot.page - 1)} className="rounded-control border border-border px-3 py-2 disabled:opacity-40">Previous</button>
          <span>{snapshot.page} / {pageCount}</span>
          <button type="button" disabled={snapshot.page >= pageCount} onClick={() => changePage(snapshot.page + 1)} className="rounded-control border border-border px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      </nav>}
      <section aria-labelledby="artwork-catalog-heading" className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 id="artwork-catalog-heading" className="text-base font-semibold text-ink">
              Asset artwork
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
              Sourced token and company artwork. The table above shows only programs available in the live index.
            </p>
          </div>
          <span className="text-xs text-ink-muted">4 sourced images</span>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {artworkCatalog.map(({ symbol, artwork }) => (
            <li key={symbol} className="flex items-center gap-4 rounded-control border border-border bg-surface px-4 py-4">
              <AssetIcon symbol={symbol} size={48} />
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{symbol}</span>
                <span className="block text-xs text-ink-muted">{artwork} · Status unavailable</span>
              </div>
            </li>
          ))}
        </ul>
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
                  {event.symbol ?? "Unmatched listing"}{" "}
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
