create extension if not exists pg_cron;

revoke all on schema cron from public;
revoke all on all tables in schema cron from public, anon, authenticated;
revoke execute on all functions in schema cron from public, anon, authenticated;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table internal.retention_purge_runs (
  id uuid primary key default gen_random_uuid(),
  target text not null
    check (target in ('agent_traces', 'copilot_observability', 'human_tasks')),
  status text not null check (status in ('succeeded', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  agent_traces_deleted bigint not null default 0 check (agent_traces_deleted >= 0),
  conversation_turns_deleted bigint not null default 0 check (conversation_turns_deleted >= 0),
  cost_records_deleted bigint not null default 0 check (cost_records_deleted >= 0),
  events_deleted bigint not null default 0 check (events_deleted >= 0),
  human_tasks_deleted bigint not null default 0 check (human_tasks_deleted >= 0),
  error_class text,
  constraint retention_purge_runs_time_check check (completed_at >= started_at),
  constraint retention_purge_runs_error_check check (
    (status = 'succeeded' and error_class is null)
    or (status = 'failed' and error_class is not null and char_length(error_class) = 5)
  )
);

create index retention_purge_runs_target_completed_idx
  on internal.retention_purge_runs(target, completed_at desc);

revoke all on table internal.retention_purge_runs from public, anon, authenticated;

comment on table internal.retention_purge_runs is
  'Private retention execution evidence. Stores only normalized status, bounded row counts, and SQLSTATE; never row content or raw errors.';

create or replace function internal.run_retention_purge(p_target text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
  run_started_at timestamptz := clock_timestamp();
  agent_traces_deleted bigint := 0;
  conversation_turns_deleted bigint := 0;
  cost_records_deleted bigint := 0;
  events_deleted bigint := 0;
  human_tasks_deleted bigint := 0;
begin
  if p_target is null or p_target not in ('agent_traces', 'copilot_observability', 'human_tasks') then
    raise exception using errcode = '22023', message = 'Unsupported retention purge target';
  end if;

  begin
    case p_target
      when 'agent_traces' then
        select internal.purge_expired_agent_traces()::bigint
          into agent_traces_deleted;
      when 'copilot_observability' then
        select
          result.conversation_turns_deleted::bigint,
          result.cost_records_deleted::bigint,
          result.events_deleted::bigint
        into
          conversation_turns_deleted,
          cost_records_deleted,
          events_deleted
        from internal.purge_expired_copilot_observability() as result;
      when 'human_tasks' then
        select internal.purge_expired_human_tasks()
          into human_tasks_deleted;
    end case;
  exception when others then
    insert into internal.retention_purge_runs (
      target,
      status,
      started_at,
      completed_at,
      error_class
    ) values (
      p_target,
      'failed',
      run_started_at,
      clock_timestamp(),
      sqlstate
    )
    returning id into run_id;

    return run_id;
  end;

  insert into internal.retention_purge_runs (
    target,
    status,
    started_at,
    completed_at,
    agent_traces_deleted,
    conversation_turns_deleted,
    cost_records_deleted,
    events_deleted,
    human_tasks_deleted
  ) values (
    p_target,
    'succeeded',
    run_started_at,
    clock_timestamp(),
    agent_traces_deleted,
    conversation_turns_deleted,
    cost_records_deleted,
    events_deleted,
    human_tasks_deleted
  )
  returning id into run_id;

  return run_id;
end;
$$;

revoke all on function internal.run_retention_purge(text) from public, anon, authenticated;

create or replace view internal.retention_purge_health
with (security_invoker = true)
as
with targets(target) as (
  values
    ('agent_traces'::text),
    ('copilot_observability'::text),
    ('human_tasks'::text)
),
last_runs as (
  select distinct on (target)
    target,
    status as last_status,
    completed_at as last_completed_at
  from internal.retention_purge_runs
  order by target, completed_at desc, id desc
)
select
  targets.target,
  last_runs.last_status,
  last_runs.last_completed_at,
  (
    select count(*)::bigint
    from internal.retention_purge_runs failed
    where failed.target = targets.target
      and failed.status = 'failed'
      and not exists (
        select 1
        from internal.retention_purge_runs later_success
        where later_success.target = targets.target
          and later_success.status = 'succeeded'
          and later_success.completed_at > failed.completed_at
      )
  ) as consecutive_failures,
  (
    last_runs.last_completed_at is null
    or last_runs.last_status = 'failed'
    or last_runs.last_completed_at < now() - interval '26 hours'
  ) as needs_attention
from targets
left join last_runs using (target);

revoke all on table internal.retention_purge_health from public, anon, authenticated;

select cron.schedule(
  'visepanda-purge-agent-traces',
  '10 2 * * *',
  $cron$select internal.run_retention_purge('agent_traces');$cron$
);

select cron.schedule(
  'visepanda-purge-copilot-observability',
  '20 2 * * *',
  $cron$select internal.run_retention_purge('copilot_observability');$cron$
);

select cron.schedule(
  'visepanda-purge-human-tasks',
  '30 2 * * *',
  $cron$select internal.run_retention_purge('human_tasks');$cron$
);
