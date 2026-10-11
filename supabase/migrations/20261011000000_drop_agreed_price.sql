-- Agreed price is no longer tracked in the portal (the admin form, the client's contract list and every query stopped
-- reading it). Apply this AFTER the matching site release is live: pages from before that release still select the
-- column, and selecting a column that no longer exists makes the whole request fail.
--
-- Check first that nothing needs keeping:
--   select count(*) from public.clients where agreed_price is not null;

alter table public.clients drop column if exists agreed_price;
