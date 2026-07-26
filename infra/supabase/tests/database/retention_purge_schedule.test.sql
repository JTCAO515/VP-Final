begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

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

select is(
  (select count(*) from cron.job where jobname like 'visepanda-purge-%'),
  3::bigint,
  'exactly three VisePanda retention jobs are scheduled'
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
