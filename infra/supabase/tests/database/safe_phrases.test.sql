begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '34900000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'safe-phrase-reviewer@example.com',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.ops_memberships (user_id, role)
values ('34900000-0000-4000-8000-000000000001', 'editor');

select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'safe_phrases'),
  'safe phrases have a dedicated private table'
);

select lives_ok(
  $$insert into public.safe_phrases (
    category, scene, intent_key, variant_key, severity, chinese_expression, english_intent,
    source_locator, evidence_summary, verified_by, verified_at, expires_at, review_policy, status
  ) values (
    'allergy_dietary', 'restaurant', 'peanut-allergy', 'full', 'severe',
    '[operator-curated-expression]', 'Communicate a severe peanut allergy.',
    'ops://safe-phrases/peanut-allergy/full/severe',
    'An approved bilingual reviewer verified this fixed expression.',
    '34900000-0000-4000-8000-000000000001', now() - interval '1 day', now() + interval '89 days',
    'operator-verified-90d-v1', 'reviewed'
  )$$,
  'a reviewed operator-verified phrase can be retained'
);

select throws_ok(
  $$insert into public.safe_phrases (
    category, scene, intent_key, variant_key, severity, chinese_expression, english_intent,
    source_locator, evidence_summary, status
  ) values (
    'allergy_dietary', 'restaurant', 'unverified-allergy', 'full', 'standard',
    '[operator-curated-expression]', 'Communicate an allergy.',
    'ops://safe-phrases/unverified-allergy/full/standard',
    'A reviewer has not verified this expression.', 'reviewed'
  )$$,
  '23514',
  null,
  'a reviewed phrase cannot omit verification provenance'
);

select lives_ok(
  $$insert into public.safe_phrases (
    category, scene, intent_key, variant_key, severity, chinese_expression, english_intent,
    source_locator, evidence_summary, verified_by, verified_at, expires_at, review_policy, status
  ) values (
    'allergy_dietary', 'restaurant', 'expired-allergy', 'full', 'standard',
    '[operator-curated-expression]', 'A retained expired expression.',
    'ops://safe-phrases/expired-allergy/full/standard',
    'An approved bilingual reviewer verified this expired expression.',
    '34900000-0000-4000-8000-000000000001', now() - interval '10 days', now() - interval '1 day',
    'operator-verified-90d-v1', 'reviewed'
  )$$,
  'an expired reviewed phrase remains retained for review and is filtered by the domain gate'
);

select lives_ok(
  $$insert into public.safe_phrases (
    category, scene, intent_key, variant_key, severity, chinese_expression, english_intent,
    source_locator, evidence_summary, verified_by, verified_at, expires_at, review_policy, status
  ) values (
    'allergy_dietary', 'restaurant', 'peanut-allergy', 'full', 'standard',
    '[operator-curated-expression]', 'Communicate a peanut preference.',
    'ops://safe-phrases/peanut-allergy/full/standard',
    'An approved bilingual reviewer verified the standard fixed expression.',
    '34900000-0000-4000-8000-000000000001', now() - interval '1 day', now() + interval '89 days',
    'operator-verified-90d-v1', 'reviewed'
  )$$,
  'a standard and severe variant can coexist without sharing a selection key'
);

select throws_ok(
  $$insert into public.safe_phrases (
    category, scene, intent_key, variant_key, severity, chinese_expression, english_intent,
    source_locator, evidence_summary, verified_by, verified_at, expires_at, review_policy, status
  ) values (
    'allergy_dietary', 'restaurant', 'peanut-allergy', 'full', 'severe',
    '[operator-curated-expression]', 'Duplicate severe allergy expression.',
    'ops://safe-phrases/peanut-allergy/full/severe-duplicate',
    'An approved bilingual reviewer verified a duplicate selection.',
    '34900000-0000-4000-8000-000000000001', now() - interval '1 day', now() + interval '89 days',
    'operator-verified-90d-v1', 'reviewed'
  )$$,
  '23505',
  null,
  'two reviewed phrases cannot share one exact category scene intent variant and severity selection'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'safe_phrases'
      and column_name in ('user_id', 'anon_id', 'email', 'message', 'conversation_id')
  ),
  0,
  'safe phrases contain no traveler or conversation data columns'
);

select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.safe_phrases'::regclass
  ),
  true,
  'safe phrases enforce row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'safe_phrases'
  ),
  0,
  'safe phrases have no direct public read policy'
);

set local role anon;

select throws_ok(
  $$select count(*) from public.safe_phrases$$,
  '42501',
  null,
  'anonymous clients cannot read fixed expressions directly'
);

reset role;

select * from finish();
rollback;
