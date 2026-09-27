-- PRD §9.3 — Realtime. The web app subscribes per screen and never polls these tables.
alter publication supabase_realtime add table status_current;
alter publication supabase_realtime add table halt_events;
alter publication supabase_realtime add table oracle_watch_events;
alter publication supabase_realtime add table heartbeats;
alter publication supabase_realtime add table source_health;
