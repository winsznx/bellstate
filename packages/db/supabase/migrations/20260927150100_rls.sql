-- PRD §9.2 — Row-level security. Public read (anon) on the listed tables only; everything
-- else has RLS enabled with no policies, so it defaults to deny for anon/authenticated.
-- Writes go only through the service role from Workers, which bypasses RLS entirely.

alter table venues enable row level security;
alter table listings enable row level security;
alter table programs enable row level security;
alter table tokens enable row level security;
alter table pools enable row level security;
alter table halt_events enable row level security;
alter table status_current enable row level security;
alter table status_history enable row level security;
alter table heartbeats enable row level security;
alter table pool_events enable row level security;
alter table perp_markets enable row level security;
alter table perp_snapshots enable row level security;
alter table oracle_watch_events enable row level security;
alter table replays enable row level security;
alter table replay_frames enable row level security;
alter table signers enable row level security;
alter table source_health enable row level security;
alter table calendar_drift enable row level security;

-- No anon access (RLS enabled, no policy granted below): attestations, submissions,
-- subscriptions, deliveries, tg_link_tokens, api_payments, ops_audit, catalog_changes.
alter table attestations enable row level security;
alter table submissions enable row level security;
alter table subscriptions enable row level security;
alter table deliveries enable row level security;
alter table tg_link_tokens enable row level security;
alter table api_payments enable row level security;
alter table ops_audit enable row level security;
alter table catalog_changes enable row level security;

create policy "public read" on venues for select using (true);
create policy "public read" on listings for select using (true);
create policy "public read" on programs for select using (true);
create policy "public read" on tokens for select using (true);
create policy "public read" on pools for select using (true);
create policy "public read" on halt_events for select using (true);
create policy "public read" on status_current for select using (true);
create policy "public read" on status_history for select using (true);
create policy "public read" on heartbeats for select using (true);
create policy "public read" on pool_events for select using (true);
create policy "public read" on perp_markets for select using (true);
create policy "public read" on perp_snapshots for select using (true);
create policy "public read" on oracle_watch_events for select using (true);
create policy "public read" on signers for select using (true);
create policy "public read" on source_health for select using (true);
create policy "public read" on calendar_drift for select using (true);

-- replays: published only.
create policy "public read published" on replays for select using (published = true);
create policy "public read frames of published replays" on replay_frames for select using (
    exists (select 1 from replays r where r.slug = replay_frames.replay_slug and r.published = true)
);
