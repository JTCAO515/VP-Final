begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

select ok(
  exists (select 1 from pg_extension where extname = 'pg_cron'),
  'pg_cron is enabled'
);
select has_table('internal', 'retention_purge_runs', 'purge audit table exists');
select has_view('internal', 'retention_purge_health', 'purge health view exists');
select has_function('internal', 'run_retention_purge', array['text'], 'restricted purge wrapper exists');

select is(
  has_table_privilege('anon', 'internal.retention_purge_runs', 'select'),
  false,
  'anonymous clients cannot read purge evidence'
);
select is(
  has_table_privilege('authenticated', 'internal.retention_purge_runs', 'select'),
  false,
  'authenticated clients cannot read purge evidence'
);
select is(
  has_function_privilege('anon', 'internal.run_retention_purge(text)', 'execute'),
  false,
  'anonymous clients cannot execute the purge wrapper'
);
select is(
  has_function_privilege('authenticated', 'internal.run_retention_purge(text)', 'execute'),
  false,
  'authenticated clients cannot execute the purge wrapper'
);

select throws_ok(
  $$select internal.run_retention_purge(null)$$,
  '22023',
  'Unsupported retention purge target',
  'the purge wrapper rejects a null target'
);

select is(
  (select count(*) from cron.job where jobname like 'visepanda-purge-%'),
  5::bigint,
  'exactly five VisePanda retention jobs are scheduled'
);
select is(
  (select schedule from cron.job where jobname = 'visepanda-purge-agent-traces'),
  '10 2 * * *',
  'agent trace purge runs daily at 02:10 UTC'
);
select is(
  (select schedule from cron.job where jobname = 'visepanda-purge-copilot-observability'),
  '20 2 * * *',
  'Copilot observability purge runs daily at 02:20 UTC'
);
select is(
  (select schedule from cron.job where jobname = 'visepanda-purge-human-tasks'),
  '30 2 * * *',
  'Human Task purge runs daily at 02:30 UTC'
);
select is(
  (select schedule from cron.job where jobname = 'visepanda-purge-readiness-assessments'),
  '40 2 * * *',
  'Readiness assessment purge runs daily at 02:40 UTC'
);
select is(
  (select schedule from cron.job where jobname = 'visepanda-purge-early-access-signups'),
  '50 2 * * *',
  'Early Access signup purge runs daily at 02:50 UTC'
);
select matches(
  (select command from cron.job where jobname = 'visepanda-purge-agent-traces'),
  $$run_retention_purge\('agent_traces'\)$$,
  'agent trace job calls only the reviewed wrapper target'
);
select matches(
  (select command from cron.job where jobname = 'visepanda-purge-copilot-observability'),
  $$run_retention_purge\('copilot_observability'\)$$,
  'Copilot job calls only the reviewed wrapper target'
);
select matches(
  (select command from cron.job where jobname = 'visepanda-purge-human-tasks'),
  $$run_retention_purge\('human_tasks'\)$$,
  'Human Task job calls only the reviewed wrapper target'
);
select matches(
  (select command from cron.job where jobname = 'visepanda-purge-readiness-assessments'),
  $$run_retention_purge\('readiness_assessments'\)$$,
  'Readiness job calls only the reviewed wrapper target'
);
select matches(
  (select command from cron.job where jobname = 'visepanda-purge-early-access-signups'),
  $$run_retention_purge\('early_access_signups'\)$$,
  'Early Access job calls only the reviewed wrapper target'
);

insert into public.agent_runs (id, anon_id, status, expires_at)
values
  ('31100000-0000-4000-8000-000000000001', 'expired-retention-test', 'failed', now() - interval '1 day'),
  ('31100000-0000-4000-8000-000000000002', 'current-retention-test', 'succeeded', now() + interval '1 day');

select internal.run_retention_purge('agent_traces');

select is(
  (select count(*) from public.agent_runs where id = '31100000-0000-4000-8000-000000000001'),
  0::bigint,
  'scheduled wrapper deletes an expired Agent Run'
);
select is(
  (select count(*) from public.agent_runs where id = '31100000-0000-4000-8000-000000000002'),
  1::bigint,
  'scheduled wrapper preserves a current Agent Run'
);
select is(
  (select status from internal.retention_purge_runs where target = 'agent_traces' order by completed_at desc, id desc limit 1),
  'succeeded',
  'successful purge records a normalized status'
);
select is(
  (select agent_traces_deleted from internal.retention_purge_runs where target = 'agent_traces' order by completed_at desc, id desc limit 1),
  1::bigint,
  'successful purge records its deleted row count'
);

select internal.run_retention_purge('copilot_observability');
select is(
  (select status from internal.retention_purge_runs where target = 'copilot_observability' order by completed_at desc, id desc limit 1),
  'succeeded',
  'Copilot observability wrapper records execution evidence'
);

select internal.run_retention_purge('human_tasks');
select is(
  (select status from internal.retention_purge_runs where target = 'human_tasks' order by completed_at desc, id desc limit 1),
  'succeeded',
  'Human Task wrapper records execution evidence'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '31100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'readiness-retention@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
)
on conflict (id) do nothing;
insert into public.users (id, email)
values ('31100000-0000-4000-8000-000000000002', 'readiness-retention@example.com')
on conflict (id) do nothing;
insert into public.readiness_assessments (
  user_id, assessment_jsonb, result_jsonb, consented_at, created_at, retention_expires_at
) values (
  '31100000-0000-4000-8000-000000000002', '{}', '{}',
  now() - interval '2 days', now() - interval '2 days', now() - interval '1 day'
);
select internal.run_retention_purge('readiness_assessments');
select is(
  (select count(*) from public.readiness_assessments where retention_expires_at <= now()),
  0::bigint,
  'Readiness wrapper deletes expired assessments'
);
select is(
  (select readiness_assessments_deleted from internal.retention_purge_runs where target = 'readiness_assessments' order by completed_at desc, id desc limit 1),
  1::bigint,
  'Readiness wrapper records its deleted row count'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'internal'
      and table_name = 'retention_purge_runs'
      and column_name in (
        'user_id',
        'anon_id',
        'email',
        'contact',
        'prompt',
        'response',
        'api_key',
        'cookie',
        'signature',
        'error_message'
      )
  ),
  0::bigint,
  'purge evidence stores no identity, content, credential, signature, or raw error column'
);

delete from internal.retention_purge_runs where target = 'agent_traces';
insert into internal.retention_purge_runs (
  target,
  status,
  started_at,
  completed_at,
  error_class
) values
  ('agent_traces', 'failed', now() - interval '50 minutes', now() - interval '49 minutes', 'XX000'),
  ('agent_traces', 'failed', now() - interval '20 minutes', now() - interval '19 minutes', 'XX000');

select is(
  (select consecutive_failures from internal.retention_purge_health where target = 'agent_traces'),
  2::bigint,
  'health view exposes consecutive failures'
);
select is(
  (select needs_attention from internal.retention_purge_health where target = 'agent_traces'),
  true,
  'health view marks a failed target for attention'
);

insert into internal.retention_purge_runs (
  target,
  status,
  started_at,
  completed_at
) values (
  'agent_traces',
  'succeeded',
  now() - interval '2 minutes',
  now() - interval '1 minute'
);

select is(
  (select consecutive_failures from internal.retention_purge_health where target = 'agent_traces'),
  0::bigint,
  'a later success clears the consecutive-failure count'
);
select is(
  (select needs_attention from internal.retention_purge_health where target = 'agent_traces'),
  false,
  'a recent success clears the attention flag'
);

select * from finish();
rollback;
