-- Real seed data: the 7 venues in PRD §3.1/§4.1-4.4/Appendix C, matching packages/calendars'
-- FAMILY_BY_MIC/TIMEZONE_BY_MIC exactly. halt_source matches which packages/sources parser
-- covers that venue's family. observable mirrors §2.3's per-family observability row.

insert into venues (mic, name, tz, family, currency, halt_source, observable) values
  ('XNAS', 'Nasdaq', 'America/New_York', 'US', 'USD', 'nasdaq-rss',
   '{"singleStockHalt": true, "marketWideHalt": true, "priceLimitLock": false, "programPause": true, "primaryWindow": true, "valuationStream": true}'::jsonb),
  ('XNYS', 'NYSE', 'America/New_York', 'US', 'USD', 'nasdaq-rss',
   '{"singleStockHalt": true, "marketWideHalt": true, "priceLimitLock": false, "programPause": true, "primaryWindow": true, "valuationStream": true}'::jsonb),
  ('ARCX', 'NYSE Arca', 'America/New_York', 'US', 'USD', 'nasdaq-rss',
   '{"singleStockHalt": true, "marketWideHalt": true, "priceLimitLock": false, "programPause": true, "primaryWindow": true, "valuationStream": true}'::jsonb),
  ('XASE', 'NYSE American', 'America/New_York', 'US', 'USD', 'nasdaq-rss',
   '{"singleStockHalt": true, "marketWideHalt": true, "priceLimitLock": false, "programPause": true, "primaryWindow": true, "valuationStream": true}'::jsonb),
  ('XHKG', 'HKEX', 'Asia/Hong_Kong', 'HK', 'HKD', 'hkexnews',
   '{"singleStockHalt": true, "marketWideHalt": null, "priceLimitLock": false, "programPause": true, "primaryWindow": true, "valuationStream": false}'::jsonb),
  ('XKRX', 'Korea Exchange', 'Asia/Seoul', 'KR', 'KRW', 'kind',
   '{"singleStockHalt": false, "marketWideHalt": null, "priceLimitLock": false, "programPause": true, "primaryWindow": true, "valuationStream": false}'::jsonb),
  ('NXTE', 'Nextrade', 'Asia/Seoul', 'KR', 'KRW', 'kind',
   '{"singleStockHalt": false, "marketWideHalt": null, "priceLimitLock": false, "programPause": true, "primaryWindow": true, "valuationStream": false}'::jsonb)
on conflict (mic) do update set
  name = excluded.name,
  tz = excluded.tz,
  family = excluded.family,
  currency = excluded.currency,
  halt_source = excluded.halt_source,
  observable = excluded.observable;
