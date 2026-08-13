begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public', 'readiness_assessments', 'readiness assessment table exists');
select has_column('public', 'readiness_assessments', 'assessment_jsonb', 'assessment is retained');
select has_column('public', 'readiness_assessments', 'result_jsonb', 'deterministic result is retained');
select has_column('public', 'readiness_assessments', 'consented_at', 'explicit consent time is retained');
select has_column('public', 'readiness_assessments', 'retention_expires_at', 'retention deadline is retained');
select has_index('public', 'readiness_assessments', 'readiness_assessments_user_created_idx', 'user lookup index exists');
select has_index('public', 'readiness_assessments', 'readiness_assessments_trip_created_idx', 'Trip lookup index exists');
select has_index('public', 'readiness_assessments', 'readiness_assessments_retention_expires_idx', 'retention purge index exists');

select is(
  has_table_privilege('anon', 'public.readiness_assessments', 'select'),
  false,
  'anonymous clients cannot read readiness records through the Data API'
);
select is(
  has_table_privilege('authenticated', 'public.readiness_assessments', 'insert'),
  false,
  'authenticated clients cannot write readiness records through the Data API'
);

select throws_ok(
  $$insert into public.readiness_assessments (assessment_jsonb, result_jsonb, consented_at, retention_expires_at) values ('{}', '{}', now(), now() + interval '1 day')$$,
  '23514',
  'new row for relation "readiness_assessments" violates check constraint "readiness_assessments_user_or_trip_check"',
  'every persisted readiness record belongs to an account or Trip'
);
select throws_ok(
  $$insert into public.readiness_assessments (user_id, assessment_jsonb, result_jsonb, consented_at, retention_expires_at) values ('00000000-0000-4000-8000-000000000001', '[]', '{}', now(), now() + interval '1 day')$$,
  '23514',
  'new row for relation "readiness_assessments" violates check constraint "readiness_assessments_assessment_jsonb_check"',
  'assessment payload must be an object'
);

select is(
  has_function_privilege('anon', 'internal.purge_expired_readiness_assessments()', 'execute'),
  false,
  'readiness purge function is not directly executable by public roles'
);

select * from finish();
rollback;
