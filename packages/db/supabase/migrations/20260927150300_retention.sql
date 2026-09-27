-- PRD §9.4 — retention (free-tier budget). Daily pg_cron job prunes perp_snapshots (48h),
-- attestations (30d) and deliveries (30d). Everything else is kept. retention_runs lets the
-- API's retention cron verify the daily prune actually ran (PRD §9.4's own requirement).
create extension if not exists pg_cron with schema extensions;

create table retention_runs (
    id uuid primary key default gen_random_uuid(),
    ran_at timestamptz not null default now(),
    perp_snapshots_deleted bigint not null,
    attestations_deleted bigint not null,
    deliveries_deleted bigint not null
);
alter table retention_runs enable row level security;
-- No anon policy: same "no anon access" class as ops_audit — internal operational record.

create or replace function run_retention() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_perp_deleted bigint;
    v_attestations_deleted bigint;
    v_deliveries_deleted bigint;
begin
    delete from perp_snapshots where t < now() - interval '48 hours';
    get diagnostics v_perp_deleted = row_count;

    delete from attestations where received_at < now() - interval '30 days';
    get diagnostics v_attestations_deleted = row_count;

    delete from deliveries where next_attempt_at is not null and next_attempt_at < now() - interval '30 days';
    get diagnostics v_deliveries_deleted = row_count;

    insert into retention_runs (perp_snapshots_deleted, attestations_deleted, deliveries_deleted)
    values (v_perp_deleted, v_attestations_deleted, v_deliveries_deleted);
end;
$$;

select cron.schedule('bellstate-retention-daily', '0 3 * * *', 'select run_retention();');
