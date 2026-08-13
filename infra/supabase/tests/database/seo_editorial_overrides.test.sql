begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '35000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'seo-editor@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.ops_memberships (user_id, role)
values ('35000000-0000-4000-8000-000000000001', 'editor');

insert into public.pois (id, city, category, name_en)
values ('35000000-0000-4000-8000-000000000002', 'Shanghai', 'attraction', 'SEO Test POI');

select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'seo_editorial_overrides'),
  'SEO overrides have a dedicated private presentation table'
);

select lives_ok(
  $$insert into public.seo_editorial_overrides (poi_id, intent, title, created_by, updated_by)
    values ('35000000-0000-4000-8000-000000000002', 'transport', 'Getting to the test POI',
      '35000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001')$$,
  'a bounded editorial title override can be retained'
);

select throws_ok(
  $$insert into public.seo_editorial_overrides (poi_id, intent, created_by, updated_by)
    values ('35000000-0000-4000-8000-000000000002', 'payment',
      '35000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'an override cannot be empty'
);

select throws_ok(
  $$insert into public.seo_editorial_overrides (poi_id, intent, summary, created_by, updated_by)
    values ('35000000-0000-4000-8000-000000000002', 'not_an_intent', 'Unsupported intent',
      '35000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'an override uses only frozen SEO intent names'
);

select throws_ok(
  $$insert into public.seo_editorial_overrides (poi_id, intent, title, created_by, updated_by)
    values ('35000000-0000-4000-8000-000000000002', 'transport', 'A second override',
      '35000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'one POI and intent have only one override row'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.seo_editorial_overrides'::regclass),
  true, 'SEO overrides enforce row-level security'
);

select is(
  has_table_privilege('anon', 'public.seo_editorial_overrides', 'select'),
  false, 'anonymous clients cannot read editorial overrides'
);

select is(
  has_table_privilege('authenticated', 'public.seo_editorial_overrides', 'insert'),
  false, 'authenticated clients cannot write editorial overrides directly'
);

select is(
  (select count(*)::integer from information_schema.columns
    where table_schema = 'public' and table_name = 'seo_editorial_overrides'
      and column_name in ('fact_id', 'source_locator', 'evidence_summary', 'reviewed_by')),
  0, 'SEO overrides do not duplicate or replace POI fact evidence columns'
);

select * from finish();
rollback;
