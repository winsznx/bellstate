Supabase migrations for Bellstate (PRD §9).

## Layout

- `supabase/migrations/20260927150000_schema.sql` — all tables (§9.1)
- `supabase/migrations/20260927150100_rls.sql` — row-level security (§9.2)
- `supabase/migrations/20260927150200_realtime.sql` — realtime publication (§9.3)
- `supabase/migrations/20260927150300_retention.sql` — pg_cron daily retention (§9.4)

## Applying to a real project

Once `SUPABASE_URL` / project ref and an access token are available (see `internal/NEEDS.md`):

```bash
supabase link --project-ref <ref>
supabase db push
```

## Local validation

The schema and RLS migrations were validated by hand against a disposable `postgres:16`
Docker container: applied in order, then confirmed with a simulated `anon` role that public
tables (e.g. `venues`) are readable, `subscriptions`/`attestations`/`ops_audit` are not, writes
are rejected outright, and `replays` only exposes `published = true` rows.

The retention migration (`pg_cron`) needs an image that bundles the extension
(`supabase/postgres`, not plain `postgres`) — not yet re-validated locally after a Docker
daemon hang during that image pull; re-run against a real Supabase project (which has
`pg_cron` natively) or a `supabase/postgres` container once Docker is healthy again.

## Tests

`tests/rls.test.ts` (Vitest) runs the same checks as a repeatable suite. Point
`TEST_DATABASE_URL` at a Postgres instance with the migrations applied:

```bash
docker run --rm -d --name bellstate-db-test -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
for f in supabase/migrations/*.sql; do
  # skip the pg_cron migration against plain postgres — it lacks the extension
  [[ "$f" == *retention* ]] && continue
  docker exec -i bellstate-db-test psql -U postgres -v ON_ERROR_STOP=1 < "$f"
done
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres pnpm test
docker stop bellstate-db-test
```
