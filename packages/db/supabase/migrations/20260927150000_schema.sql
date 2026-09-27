-- PRD §9.1 — core schema. Domains enforce the PRD's ID/hash/address shapes so bad writes
-- fail at the database, not silently propagate to the API.

create extension if not exists pgcrypto;

-- 32-byte hex (bytes32 ids/digests/tx hashes): listingId, programId, subjectId, digest, tx_hash.
create domain hex32 as text check (value ~ '^0x[0-9a-f]{64}$');
-- 20-byte hex (EVM addresses): signer, token, actor, owner wallet.
create domain hex_address as text check (value ~ '^0x[0-9a-f]{40}$');

-- ---------------------------------------------------------------------------------------------
-- Registry
-- ---------------------------------------------------------------------------------------------

create table venues (
    mic text primary key,
    name text not null,
    tz text not null,
    family text not null check (family in ('US', 'HK', 'KR')),
    currency text not null,
    halt_source text not null,
    observable jsonb not null default '{}'::jsonb
);

create table listings (
    listing_id hex32 primary key,
    mic text not null references venues (mic),
    symbol text not null,
    aliases text[] not null default '{}',
    name text,
    isin text,
    currency text,
    domain smallint not null,
    active boolean not null default true
);
create index listings_mic_idx on listings (mic);

create table programs (
    program_id hex32 primary key,
    issuer text not null,
    symbol text not null,
    name text,
    isin text,
    underlying_isin text,
    reference_listing_id hex32 references listings (listing_id),
    home_listing_ids text[] not null default '{}',
    has_primary boolean not null default false,
    valuation jsonb,
    catalog jsonb,
    active boolean not null default true
);

create table tokens (
    address hex_address primary key,
    program_id hex32 not null references programs (program_id),
    kind text not null check (kind in ('raw', 'wrapped')),
    decimals smallint not null,
    adapter hex_address,
    pool_eligible boolean not null default false
);
create index tokens_program_id_idx on tokens (program_id);

create table pools (
    pool_id hex32 primary key,
    token hex_address not null references tokens (address),
    quote hex_address not null,
    tick_spacing integer not null,
    params jsonb not null default '{}'::jsonb,
    created_block bigint not null,
    created_tx hex32 not null
);
create index pools_token_idx on pools (token);

-- ---------------------------------------------------------------------------------------------
-- Halts
-- ---------------------------------------------------------------------------------------------

create table halt_events (
    id uuid primary key default gen_random_uuid(),
    dedupe_key text not null unique, -- "symbol:haltAtSec"
    family text not null check (family in ('US', 'HK', 'KR')),
    listing_id hex32 references listings (listing_id),
    source text not null check (source in ('nasdaq', 'nyse', 'hkex', 'kind')),
    reason_code text,
    reason_category smallint,
    halt_at timestamptz not null,
    resume_quote_at timestamptz,
    resume_trade_at timestamptz,
    raw jsonb not null,
    source_url text not null,
    first_seen_at timestamptz not null default now(),
    first_seen_by text,
    last_seen_at timestamptz not null default now()
);
create index halt_events_listing_id_idx on halt_events (listing_id);
create index halt_events_halt_at_idx on halt_events (halt_at desc);

-- ---------------------------------------------------------------------------------------------
-- Attestation and submission pipeline
-- ---------------------------------------------------------------------------------------------

create table attestations (
    id uuid primary key default gen_random_uuid(),
    signer hex_address not null,
    kind text not null check (kind in ('market', 'program', 'primary', 'valuation', 'heartbeat')),
    subject_id hex32 not null,
    seq integer,
    epoch bigint not null,
    digest hex32 not null,
    message jsonb not null,
    signature text not null,
    observed_at timestamptz not null,
    source_time timestamptz,
    source_refs jsonb not null default '[]'::jsonb,
    received_at timestamptz not null default now()
);
create index attestations_subject_id_idx on attestations (subject_id);
create index attestations_received_at_idx on attestations (received_at);

create table submissions (
    id uuid primary key default gen_random_uuid(),
    tx_hash hex32,
    nonce bigint,
    digests hex32[] not null default '{}',
    status text not null check (status in ('pending', 'included', 'replaced', 'failed')),
    block_number bigint,
    block_time timestamptz,
    gas_used bigint,
    effective_gas_price numeric,
    error text,
    created_at timestamptz not null default now()
);
create index submissions_tx_hash_idx on submissions (tx_hash);

-- ---------------------------------------------------------------------------------------------
-- Effective status (mirrors onchain state)
-- ---------------------------------------------------------------------------------------------

create table status_current (
    facet text not null check (facet in ('market', 'program', 'primary', 'valuation')),
    subject_id hex32 not null,
    record jsonb not null,
    seq integer not null,
    written_at timestamptz not null,
    effective_as_of timestamptz not null,
    digest hex32 not null,
    tx_hash hex32,
    primary key (facet, subject_id)
);

create table status_history (
    id uuid primary key default gen_random_uuid(),
    facet text not null check (facet in ('market', 'program', 'primary', 'valuation')),
    subject_id hex32 not null,
    record jsonb not null,
    seq integer not null,
    tx_hash hex32,
    log_index integer,
    block_number bigint,
    t_source timestamptz,
    t_first_seen timestamptz,
    t_quorum timestamptz,
    t_submitted timestamptz,
    t_included timestamptz,
    t_indexed timestamptz not null default now(),
    source_refs jsonb not null default '[]'::jsonb
);
create index status_history_subject_id_idx on status_history (subject_id, t_included desc);

create table heartbeats (
    domain smallint not null,
    version bigint not null,
    epoch bigint not null,
    affirmed_at timestamptz not null,
    tx_hash hex32,
    primary key (domain, version)
);

create table pool_events (
    id uuid primary key default gen_random_uuid(),
    pool_id hex32 not null references pools (pool_id),
    kind text not null check (kind in ('fee', 'initialize', 'params')),
    mode smallint,
    fee integer,
    tx_hash hex32 not null,
    block_time timestamptz not null
);
create index pool_events_pool_id_idx on pool_events (pool_id, block_time desc);

-- ---------------------------------------------------------------------------------------------
-- Oracle Watch
-- ---------------------------------------------------------------------------------------------

create table perp_markets (
    dex text not null,
    name text not null,
    underlying_listing_ids text[] not null default '{}',
    primary_listing_id hex32 references listings (listing_id),
    spec_url text,
    primary key (dex, name)
);

create table perp_snapshots (
    name text not null,
    t timestamptz not null,
    oracle_px numeric,
    mark_px numeric,
    primary key (name, t)
);
create index perp_snapshots_t_idx on perp_snapshots (t);

create table oracle_watch_events (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    flag text not null,
    window_start timestamptz not null,
    window_end timestamptz,
    move_pct numeric,
    status_context jsonb not null default '{}'::jsonb
);
create index oracle_watch_events_name_idx on oracle_watch_events (name, window_start desc);

-- ---------------------------------------------------------------------------------------------
-- Ops
-- ---------------------------------------------------------------------------------------------

create table catalog_changes (
    id uuid primary key default gen_random_uuid(),
    kind text not null,
    symbol text not null,
    payload jsonb not null,
    status text not null default 'pending_review' check (status in ('pending_review', 'applied', 'dismissed')),
    reviewed_by hex_address,
    tx_hash hex32,
    created_at timestamptz not null default now()
);

create table calendar_drift (
    id uuid primary key default gen_random_uuid(),
    listing_id hex32 not null references listings (listing_id),
    checker text not null check (checker in ('xstocks', 'pyth')),
    engine jsonb not null,
    other jsonb not null,
    started_at timestamptz not null default now(),
    ended_at timestamptz
);
create index calendar_drift_listing_id_idx on calendar_drift (listing_id);

create table source_health (
    signer hex_address not null,
    source text not null,
    last_ok_at timestamptz,
    last_error text,
    last_error_at timestamptz,
    items integer,
    latency_ms integer,
    primary key (signer, source)
);

create table signers (
    address hex_address primary key,
    name text not null,
    operator text not null,
    health_url text,
    active boolean not null default true,
    added_at timestamptz not null default now()
);

create table ops_audit (
    id uuid primary key default gen_random_uuid(),
    actor hex_address not null,
    action text not null,
    params jsonb not null default '{}'::jsonb,
    tx_hash hex32,
    created_at timestamptz not null default now()
);
create index ops_audit_created_at_idx on ops_audit (created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------------------------

create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    channel text not null check (channel in ('telegram', 'webhook')),
    owner text not null, -- wallet address or "tg:<chatId>"
    target text not null,
    filters jsonb not null default '{}'::jsonb,
    secret_hash text,
    status text not null default 'active',
    consecutive_failures integer not null default 0,
    created_at timestamptz not null default now()
);
create index subscriptions_owner_idx on subscriptions (owner);

create table deliveries (
    id uuid primary key default gen_random_uuid(),
    subscription_id uuid not null references subscriptions (id),
    event_id text not null,
    attempt integer not null default 1,
    status text not null,
    http_status integer,
    latency_ms integer,
    error text,
    next_attempt_at timestamptz
);
create index deliveries_subscription_id_idx on deliveries (subscription_id);

create table tg_link_tokens (
    token text primary key,
    filters jsonb not null default '{}'::jsonb,
    expires_at timestamptz not null,
    used_at timestamptz
);

-- ---------------------------------------------------------------------------------------------
-- x402 payments
-- ---------------------------------------------------------------------------------------------

create table api_payments (
    id uuid primary key default gen_random_uuid(),
    resource text not null,
    payer hex_address,
    amount numeric,
    asset text,
    network text,
    tx_hash hex32,
    facilitator text,
    status text not null,
    created_at timestamptz not null default now()
);
create index api_payments_created_at_idx on api_payments (created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Replays
-- ---------------------------------------------------------------------------------------------

create table replays (
    slug text primary key,
    title text not null,
    summary text,
    venue_mics text[] not null default '{}',
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    published boolean not null default false
);

create table replay_frames (
    id uuid primary key default gen_random_uuid(),
    replay_slug text not null references replays (slug),
    t timestamptz not null,
    kind text not null,
    payload jsonb not null,
    provenance jsonb not null -- {type: observed|reported|derived, source_url, note}
);
create index replay_frames_replay_slug_idx on replay_frames (replay_slug, t);
