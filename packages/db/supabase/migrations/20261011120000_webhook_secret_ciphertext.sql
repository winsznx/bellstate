-- Old hash-only secrets cannot be recovered. Owners must recreate these webhooks.
alter table subscriptions add column secret_ciphertext text;
update subscriptions set status = 'disabled' where channel = 'webhook' and secret_ciphertext is null;
alter table subscriptions add constraint active_webhook_has_ciphertext
  check (channel <> 'webhook' or status <> 'active' or secret_ciphertext is not null);
