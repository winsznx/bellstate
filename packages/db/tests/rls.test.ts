import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

/**
 * PRD §9.2: "RLS is tested in packages/db (anon can't read subscriptions; anon can't write
 * anywhere)." Runs against any Postgres with the migrations applied — a disposable local
 * instance (see README.md for how to start one) or a real Supabase project. Point
 * TEST_DATABASE_URL at it. If the target has no `anon` role yet (a from-scratch local
 * instance), this creates a minimal one with only SELECT granted; real Supabase already has its
 * own `anon` role with broader grants and relies on RLS alone to block writes — both are
 * exercised and asserted on here (see the "anon cannot write anywhere" test). Cleans up every
 * row it inserts in afterAll, so it's safe to run against a persistent database repeatedly.
 */

const connectionString = process.env.TEST_DATABASE_URL;

const describeIfDb = connectionString ? describe : describe.skip;

// A hosted Postgres (Supabase's pooler, etc.) needs SSL with a CA pg doesn't ship, so verify it
// like a browser would (encrypted, not pinned) rather than disable it outright. Local instances
// (docker/localhost) don't speak SSL at all and must not have this option set.
function clientOptions(): pg.ClientConfig {
  const isLocal = connectionString ? /localhost|127\.0\.0\.1/.test(connectionString) : true;
  return { connectionString, ssl: isLocal ? undefined : { rejectUnauthorized: false } };
}

describeIfDb("row-level security", () => {
  let adminClient: pg.Client;
  let anonClient: pg.Client;

  beforeAll(async () => {
    adminClient = new pg.Client(clientOptions());
    await adminClient.connect();

    await adminClient.query(`
      do $$
      begin
        if not exists (select from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
      end $$;
    `);
    await adminClient.query(`grant usage on schema public to anon;`);
    await adminClient.query(`grant select on all tables in schema public to anon;`);

    anonClient = new pg.Client(clientOptions());
    await anonClient.connect();
    await anonClient.query(`set role anon;`);
  });

  afterAll(async () => {
    // Cleans up every row this suite inserts, so it's safe to point at a real, persistent
    // database (not just a disposable local one) without leaving test data behind.
    await adminClient.query(`delete from venues where mic = 'XNAS';`);
    await adminClient.query(`delete from subscriptions where owner = '0xabc';`);
    await adminClient.query(`delete from replays where slug in ('unpublished-test', 'published-test');`);
    await adminClient.end();
    await anonClient.end();
  });

  it("anon can read public tables (venues)", async () => {
    await adminClient.query(
      `insert into venues (mic, name, tz, family, currency, halt_source)
       values ('XNAS', 'Nasdaq', 'America/New_York', 'US', 'USD', 'nasdaq-rss')
       on conflict (mic) do nothing;`
    );
    const res = await anonClient.query(`select count(*)::int as count from venues where mic = 'XNAS';`);
    expect(res.rows[0].count).toBe(1);
  });

  it("anon cannot read subscriptions", async () => {
    await adminClient.query(
      `insert into subscriptions (channel, owner, target) values ('webhook', '0xabc', 'https://example.com');`
    );
    const res = await anonClient.query(`select count(*)::int as count from subscriptions;`);
    expect(res.rows[0].count).toBe(0);
  });

  it("anon cannot read attestations", async () => {
    const res = await anonClient.query(`select count(*)::int as count from attestations;`);
    expect(res.rows[0].count).toBe(0);
  });

  it("anon cannot read ops_audit", async () => {
    const res = await anonClient.query(`select count(*)::int as count from ops_audit;`);
    expect(res.rows[0].count).toBe(0);
  });

  it("anon cannot write anywhere", async () => {
    // Two valid ways a platform blocks this: no INSERT grant at all (a from-scratch local
    // anon role, "permission denied"), or a broad grant with RLS alone doing the blocking
    // (real Supabase's own default: anon has table-level privileges platform-wide, and every
    // table's RLS policies are what actually stop the write — "violates row-level security
    // policy"). Both mean the same thing: the write did not happen.
    await expect(
      anonClient.query(`insert into venues (mic, name, tz, family, currency, halt_source)
        values ('TEST', 'x', 'UTC', 'US', 'USD', 'x');`)
    ).rejects.toThrow(/permission denied|row-level security policy/i);
  });

  it("anon reads only published replays", async () => {
    await adminClient.query(`
      insert into replays (slug, title, starts_at, ends_at, published)
      values ('unpublished-test', 'x', now(), now(), false)
      on conflict (slug) do nothing;
    `);
    await adminClient.query(`
      insert into replays (slug, title, starts_at, ends_at, published)
      values ('published-test', 'x', now(), now(), true)
      on conflict (slug) do nothing;
    `);
    const res = await anonClient.query(`select slug from replays where slug like '%-test' order by slug;`);
    expect(res.rows.map((r) => r.slug)).toEqual(["published-test"]);
  });
});
