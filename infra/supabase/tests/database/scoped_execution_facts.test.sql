begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '56000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'scoped-fact-reviewer@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.ops_memberships (user_id, role)
values ('56000000-0000-4000-8000-000000000001', 'editor');

insert into public.pois (id, city, category, name_en, source_ids)
values ('56000000-0000-4000-8000-000000000002', 'Shanghai', 'attraction', 'Scoped Fact POI', '{}'::jsonb);

select has_table('public', 'scoped_execution_facts', 'scoped execution fact table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.scoped_execution_facts'::regclass),
  'scoped execution facts enable RLS'
);
select is(
  has_table_privilege('anon', 'public.scoped_execution_facts', 'select'),
  false,
  'anonymous Data API clients cannot read scoped facts directly'
);
select is(
  has_table_privilege('authenticated', 'public.scoped_execution_facts', 'select'),
  false,
  'authenticated Data API clients cannot read scoped facts directly'
);
select is(
  has_table_privilege('authenticated', 'public.scoped_execution_facts', 'insert'),
  false,
  'authenticated Data API clients cannot write scoped facts directly'
);
select has_index('public', 'scoped_execution_facts', 'scoped_execution_facts_poi_lookup_idx', 'POI lookup is indexed');
select has_index('public', 'scoped_execution_facts', 'scoped_execution_facts_city_lookup_idx', 'city lookup is indexed');
select has_index('public', 'scoped_execution_facts', 'scoped_execution_facts_scene_lookup_idx', 'scene lookup is indexed');
select has_index('public', 'scoped_execution_facts', 'scoped_execution_facts_national_lookup_idx', 'national lookup is indexed');

insert into public.scoped_execution_facts (
  scope, country_code, fact_type, value_jsonb, confidence, source, source_class,
  source_locator, evidence_summary
) values (
  'national', 'CN', 'payment_acceptance', '{"summary":"draft fixture"}'::jsonb, 0.9,
  'https://example.com/payment', 'official', 'https://example.com/payment',
  'Fixture evidence for the database contract.'
);

select is(
  (select count(*)::integer from public.scoped_execution_facts where scope = 'national'),
  1,
  'a valid China-national draft is accepted'
);

select throws_ok(
  $$insert into public.scoped_execution_facts (scope, country_code, city, fact_type, value_jsonb, confidence, source)
    values ('national', 'CN', 'shanghai', 'network', '{}'::jsonb, 0.5, 'fixture')$$,
  '23514', null, 'a target cannot carry fields from another scope'
);
select throws_ok(
  $$insert into public.scoped_execution_facts (scope, country_code, fact_type, value_jsonb, confidence, source)
    values ('national', 'US', 'network', '{}'::jsonb, 0.5, 'fixture')$$,
  '23514', null, 'national facts are restricted to China'
);
select throws_ok(
  $$insert into public.scoped_execution_facts (scope, city, fact_type, value_jsonb, confidence, source)
    values ('city', 'Shanghai', 'transport_rule', '{}'::jsonb, 0.5, 'fixture')$$,
  '23514', null, 'city targets must use the normalized lowercase key'
);
select throws_ok(
  $$insert into public.scoped_execution_facts (scope, scene_key, fact_type, value_jsonb, confidence, source)
    values ('scene', 'shopping_feed', 'communication', '{}'::jsonb, 0.5, 'fixture')$$,
  '23514', null, 'scene targets use only the six execution moments'
);
select throws_ok(
  $$insert into public.scoped_execution_facts (
      scope, country_code, fact_type, value_jsonb, confidence, source, status,
      verified_at, expires_at, review_policy, reviewed_by
    ) values (
      'national', 'CN', 'payment_acceptance', '{}'::jsonb, 0.5, 'fixture', 'reviewed',
      now(), now() + interval '30 days', 'volatile-30d-v1', '56000000-0000-4000-8000-000000000001'
    )$$,
  '23514', null, 'reviewed facts require eligible evidence'
);
select throws_ok(
  $$insert into public.scoped_execution_facts (
      scope, country_code, fact_type, value_jsonb, confidence, source, source_class,
      source_locator, evidence_summary, status, verified_at, expires_at, review_policy, reviewed_by
    ) values (
      'national', 'CN', 'payment_acceptance', '{}'::jsonb, 0.5, 'fixture', 'official',
      'https://example.com/payment', 'Fixture evidence', 'reviewed', now(),
      now() + interval '31 days', 'volatile-30d-v1', '56000000-0000-4000-8000-000000000001'
    )$$,
  '23514', null, 'reviewed facts cannot exceed the fact-type review window'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.scoped_execution_facts'::regclass
      and conname = 'scoped_execution_facts_target_check'
  ),
  'the closed target combination is database constrained'
);
select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'scoped_execution_facts'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'no browser-facing table grant exists'
);

select * from finish();
rollback;
