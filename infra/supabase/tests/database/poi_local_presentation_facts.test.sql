begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '51000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'local-presentation-reviewer@example.com',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.ops_memberships (user_id, role)
values ('51000000-0000-4000-8000-000000000001', 'editor');

insert into public.pois (id, city, category, name_en, name_zh, address, source_ids)
values (
  '51000000-0000-0000-0000-000000000001',
  'Address City',
  'attraction',
  'Address POI',
  '旧中文名',
  'Legacy raw address',
  '{}'::jsonb
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.poi_facts'::regclass
      and conname = 'poi_facts_local_presentation_value_check'
  ),
  'local presentation facts require their text-value shape'
);

select lives_ok(
  $$insert into public.poi_facts (
    poi_id, fact_type, value_jsonb, confidence, source, source_class, source_locator,
    evidence_summary, verified_at, expires_at, review_policy, reviewed_by, status
  ) values (
    '51000000-0000-0000-0000-000000000001',
    'local_address_zh',
    '{"text":"上海市黄浦区豫园路279号"}'::jsonb,
    1,
    'official',
    'official',
    'https://example.com/address',
    'Official source confirms the Chinese address.',
    now(),
    now() + interval '30 days',
    'execution-90d-v1',
    '51000000-0000-4000-8000-000000000001',
    'reviewed'
  )$$,
  'a reviewed source-backed Chinese address is stored as a POI fact'
);

select lives_ok(
  $$insert into public.poi_facts (
    poi_id, fact_type, value_jsonb, confidence, source, source_class, source_locator,
    evidence_summary, verified_at, expires_at, review_policy, reviewed_by, status
  ) values (
    '51000000-0000-0000-0000-000000000001',
    'local_address_zh',
    '{"text":"上海市黄浦区旧址1号"}'::jsonb,
    1,
    'official',
    'official',
    'https://example.com/expired-address',
    'Official source previously confirmed an expired Chinese address.',
    now() - interval '2 days',
    now() - interval '1 day',
    'execution-90d-v1',
    '51000000-0000-4000-8000-000000000001',
    'reviewed'
  )$$,
  'an expired local address can be retained for review without becoming public'
);

select throws_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, status)
    values ('51000000-0000-0000-0000-000000000001', 'local_address_zh', '{}'::jsonb, 0.5, 'draft', 'draft')$$,
  '23514',
  null,
  'a local address cannot omit its text value'
);

select throws_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, status)
    values ('51000000-0000-0000-0000-000000000001', 'local_name_zh', '{"text":"   "}'::jsonb, 0.5, 'draft', 'draft')$$,
  '23514',
  null,
  'a local Chinese name cannot be blank'
);

select lives_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, status)
    values ('51000000-0000-0000-0000-000000000001', 'local_address_district', '{"text":"黄浦区"}'::jsonb, 0.5, 'legacy', 'draft')$$,
  'an unreviewed local component may be retained without becoming reviewed'
);

set local role anon;

select is(
  (select count(*)::integer from public.poi_facts where poi_id = '51000000-0000-0000-0000-000000000001'),
  1,
  'anon sees only the current reviewed local address, never draft or expired components'
);

reset role;

select is(
  (select name_zh from public.pois where id = '51000000-0000-0000-0000-000000000001'),
  '旧中文名',
  'the additive fact migration leaves legacy POI strings unchanged'
);

select * from finish();
rollback;
