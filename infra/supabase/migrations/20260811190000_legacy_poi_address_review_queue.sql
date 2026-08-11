-- Legacy pois.address values have no typed source, review, or expiry evidence. Keep them
-- intact for compatibility, but expose a private live queue so operators can verify each one
-- before creating an independently reviewed local_address_zh fact.
create view public.legacy_poi_address_review_queue
with (security_invoker = true)
as
select
  p.id as poi_id,
  p.city,
  p.name_en,
  p.name_zh,
  p.address as legacy_address,
  'uncorroborated_scrape'::text as source_class,
  'legacy_unverified'::text as verification_state
from public.pois p
where p.address is not null
  and btrim(p.address) <> '';

comment on view public.legacy_poi_address_review_queue is
  'Private operator review queue for raw legacy pois.address values. Every row is unverified and ineligible for local-facing presentation; this view does not promote or infer a POI fact.';

-- The queue is a server/operator aid only. It is never a public POI, Explore, Copilot, or
-- Show-to-Local source, and future grants still respect the invoker's underlying-table access.
revoke all on public.legacy_poi_address_review_queue from anon, authenticated;
