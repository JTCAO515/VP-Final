-- Local-facing Chinese presentation values remain individual POI facts, so each
-- value has independent source, reviewer, verification, and expiry semantics.
-- Existing pois.name_zh and pois.address stay compatibility-only and are not promoted.
alter table public.poi_facts
  add constraint poi_facts_local_presentation_value_check
  check (
    fact_type not in (
      'local_name_zh',
      'local_address_zh',
      'local_address_district',
      'local_address_nearest_metro_exit',
      'local_address_visibility_note'
    )
    or coalesce((
      jsonb_typeof(value_jsonb) = 'object'
      and jsonb_typeof(value_jsonb->'text') = 'string'
      and btrim(value_jsonb->>'text') <> ''
      and char_length(btrim(value_jsonb->>'text')) <= 500
    ), false)
  );

comment on constraint poi_facts_local_presentation_value_check on public.poi_facts is
  'Local-facing Chinese name/address components require a bounded non-empty text value; reviewed eligibility remains governed by the existing POI fact evidence and expiry constraints.';
