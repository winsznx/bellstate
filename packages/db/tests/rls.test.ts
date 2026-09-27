import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

/**
 * PRD §9.2: "RLS is tested in packages/db (anon can't read subscriptions; anon can't write
 * anywhere)." Runs against a disposable Postgres instance with the migrations applied and an
 * `anon` role approximating Supabase's built-in anon grant (SELECT-only on public tables,
 * RLS enforced on top). Point TEST_DATABASE_URL at that instance; see README.md for how to
 * start one (`docker run` a plain postgres image, apply supabase/migrations/*.sql in order,
 * then create the anon role as this file does not assume Supabase's platform bootstrapping).
 */

const connectionString = process.env.TEST_DATABASE_URL;

const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb("row-level security", () => {
  let adminClient: pg.Client;
  let anonClient: pg.Client;

  beforeAll(async () => {
    adminClient = new pg.Client({ connectionString });
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

    anonClient = new pg.Client({ connectionString });
    await anonClient.connect();
    await anonClient.query(`set role anon;`);
  });

  afterAll(async () => {
    await adminClient?.end();
    await anonClient?.end();
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

  it("anon cannot write anywhere (no INSERT grant)", async () => {
    await expect(
      anonClient.query(`insert into venues (mic, name, tz, family, currency, halt_source)
        values ('TEST', 'x', 'UTC', 'US', 'USD', 'x');`)
    ).rejects.toThrow(/permission denied/i);
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
