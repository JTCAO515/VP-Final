begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.pois (id, city, category, name_en, name_zh, address, source_ids)
values
  (
    '53000000-0000-0000-0000-000000000001',
    'Legacy City',
    'attraction',
    'Legacy Address POI',
    '旧地点',
    '279 Yuyuan Old St',
    '{}'::jsonb
  ),
  (
    '53000000-0000-0000-0000-000000000002',
    'Legacy City',
    'food',
    'No Address POI',
    null,
    null,
    '{}'::jsonb
  );

select ok(
  exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'legacy_poi_address_review_queue'
  ),
  'the private legacy-address review queue exists'
);

select is(
  (
    select legacy_address
    from public.legacy_poi_address_review_queue
    where poi_id = '53000000-0000-0000-0000-000000000001'
  ),
  '279 Yuyuan Old St',
  'the queue retains the exact raw legacy address for operator verification'
);

select is(
  (
    select source_class
    from public.legacy_poi_address_review_queue
    where poi_id = '53000000-0000-0000-0000-000000000001'
  ),
  'uncorroborated_scrape',
  'legacy addresses are explicitly classified as an ineligible evidence source'
);

select is(
  (
    select verification_state
    from public.legacy_poi_address_review_queue
    where poi_id = '53000000-0000-0000-0000-000000000001'
  ),
  'legacy_unverified',
  'the queue cannot imply independent verification'
);

select is(
  (
    select count(*)::integer
    from public.legacy_poi_address_review_queue
    where poi_id = '53000000-0000-0000-0000-000000000002'
  ),
  0,
  'POIs without a raw address do not create a review queue row'
);

select is(
  (
    select count(*)::integer
    from public.poi_facts
    where poi_id = '53000000-0000-0000-0000-000000000001'
      and fact_type = 'local_address_zh'
  ),
  0,
  'the migration never promotes a legacy raw address into a local presentation fact'
);

select ok(
  not has_table_privilege('anon', 'public.legacy_poi_address_review_queue', 'select'),
  'anon cannot read the private legacy-address review queue'
);

select * from finish();
rollback;
