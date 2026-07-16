begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '50000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'knowledge-reviewer@example.com',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.ops_memberships (user_id, role)
values ('50000000-0000-4000-8000-000000000001', 'editor');

insert into public.pois (id, city, category, name_en, source_ids)
values (
  '50000000-0000-0000-0000-000000000001',
  'Lifecycle City',
  'attraction',
  'Lifecycle POI',
  '{}'::jsonb
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.poi_facts'::regclass),
  'POI facts keep row level security enabled'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'poi_facts' and column_name = 'reviewed_by'
  ),
  'POI facts retain a private reviewer reference'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.poi_facts'::regclass
      and conname = 'poi_facts_review_policy_check'
  ),
  'POI facts constrain versioned review policies'
);

select ok(
  (select column_default like '''draft''%' from information_schema.columns
   where table_schema = 'public' and table_name = 'poi_facts' and column_name = 'status'),
  'POI fact status defaults to draft'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.poi_facts'::regclass
      and conname = 'poi_facts_status_check'
  ),
  'POI facts constrain the reviewed lifecycle'
);

select throws_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, verified_at, status)
    values ('50000000-0000-0000-0000-000000000001', 'legacy', '{}'::jsonb, 0.5, 'source', now(), 'active')$$,
  '23514',
  null,
  'legacy active status cannot bypass the reviewed lifecycle'
);

select lives_ok(
  $$insert into public.poi_facts (id, poi_id, fact_type, value_jsonb, confidence, source, source_class, source_locator, evidence_summary, verified_at, expires_at, review_policy, reviewed_by, status) values
    ('50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000001', 'draft', '{}'::jsonb, 0.5, 'legacy-source', null, null, null, null, null, null, null, 'draft'),
    ('50000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000001', 'reviewed', '{}'::jsonb, 0.5, 'official', 'official', 'https://example.com/reviewed', 'Official evidence supports the reviewed fact.', now(), now() + interval '30 days', 'execution-90d-v1', '50000000-0000-4000-8000-000000000001', 'reviewed'),
    ('50000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000001', 'deprecated', '{}'::jsonb, 0.5, 'legacy-source', null, null, null, null, null, null, null, 'deprecated'),
    ('50000000-0000-0000-0000-000000000013', '50000000-0000-0000-0000-000000000001', 'rejected', '{}'::jsonb, 0.5, 'legacy-source', null, null, null, null, null, null, null, 'rejected'),
    ('50000000-0000-0000-0000-000000000014', '50000000-0000-0000-0000-000000000001', 'expired', '{}'::jsonb, 0.5, 'official', 'official', 'https://example.com/expired', 'Official evidence supports the expired fact.', now() - interval '2 days', now() - interval '1 day', 'execution-90d-v1', '50000000-0000-4000-8000-000000000001', 'reviewed'),
    ('50000000-0000-0000-0000-000000000015', '50000000-0000-0000-0000-000000000001', 'future', '{}'::jsonb, 0.5, 'official', 'official', 'https://example.com/future', 'Official evidence has a future verification time.', now() + interval '1 day', now() + interval '31 days', 'execution-90d-v1', '50000000-0000-4000-8000-000000000001', 'reviewed')$$,
  'drafts preserve missing legacy evidence while reviewed rows require complete evidence'
);

select throws_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, verified_at, status)
    values ('50000000-0000-0000-0000-000000000001', 'missing-evidence', '{}'::jsonb, 0.5, 'legacy-source', now(), 'reviewed')$$,
  '23514',
  null,
  'reviewed facts cannot omit typed evidence metadata'
);

select throws_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, source_class, source_locator, evidence_summary, verified_at, expires_at, review_policy, status)
    values ('50000000-0000-0000-0000-000000000001', 'missing-reviewer', '{}'::jsonb, 0.5, 'official', 'official', 'https://example.com/reviewed', 'Official evidence without reviewer identity.', now(), now() + interval '30 days', 'execution-90d-v1', 'reviewed')$$,
  '23514',
  null,
  'reviewed facts cannot omit reviewer identity'
);

select throws_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, source_class, source_locator, evidence_summary, verified_at, expires_at, review_policy, reviewed_by, status)
    values ('50000000-0000-0000-0000-000000000001', 'hours', '{}'::jsonb, 0.5, 'official', 'official', 'https://example.com/hours', 'Official hours evidence with an invalid long cadence.', now(), now() + interval '180 days', 'stable-180d-v1', '50000000-0000-4000-8000-000000000001', 'reviewed')$$,
  '23514',
  null,
  'reviewed facts cannot choose a longer policy than their fact type allows'
);

select throws_ok(
  $$insert into public.poi_facts (poi_id, fact_type, value_jsonb, confidence, source, source_class, source_locator, evidence_summary, verified_at, status)
    values ('50000000-0000-0000-0000-000000000001', 'model-only', '{}'::jsonb, 0.5, 'model', 'model_output', 'internal://run/1', 'Model output without independent evidence.', now(), 'reviewed')$$,
  '23514',
  null,
  'model output cannot be promoted directly to reviewed'
);

select is(
  has_table_privilege('anon', 'public.poi_facts', 'insert'),
  false,
  'anon cannot write POI facts directly'
);

set local role anon;

select is(
  (select count(*)::integer from public.poi_facts where poi_id = '50000000-0000-0000-0000-000000000001'),
  1,
  'anon sees only the current source-backed reviewed fact'
);

reset role;

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'poi_facts'
      and policyname = 'poi_facts_public_read_reviewed'
  ),
  'reviewed-only public-read policy exists'
);

select * from finish();
rollback;
