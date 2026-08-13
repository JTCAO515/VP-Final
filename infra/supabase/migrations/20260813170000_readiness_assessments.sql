create table public.readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  assessment_jsonb jsonb not null
    check (jsonb_typeof(assessment_jsonb) = 'object'),
  result_jsonb jsonb not null
    check (jsonb_typeof(result_jsonb) = 'object'),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  retention_expires_at timestamptz not null,
  constraint readiness_assessments_user_or_trip_check
    check (num_nonnulls(user_id, trip_id) >= 1),
  constraint readiness_assessments_consent_time_check
    check (consented_at <= created_at),
  constraint readiness_assessments_retention_check
    check (
      retention_expires_at > created_at
      and retention_expires_at <= created_at + interval '180 days'
    )
);

create index readiness_assessments_user_created_idx
  on public.readiness_assessments(user_id, created_at desc)
  where user_id is not null;
create index readiness_assessments_trip_created_idx
  on public.readiness_assessments(trip_id, created_at desc)
  where trip_id is not null;
create index readiness_assessments_retention_expires_idx
  on public.readiness_assessments(retention_expires_at);

alter table public.readiness_assessments enable row level security;
revoke all on table public.readiness_assessments from public, anon, authenticated;

comment on table public.readiness_assessments is
  'Server-only consented China Readiness self-reports. Fixed enum answers and deterministic results only; no free-form narrative, partner, pricing, or provider claim. Read access ends at the explicit retention deadline.';

create or replace function internal.purge_expired_readiness_assessments()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.readiness_assessments
  where retention_expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function internal.purge_expired_readiness_assessments() from public, anon, authenticated;

alter table internal.retention_purge_runs
  add column readiness_assessments_deleted bigint not null default 0
    check (readiness_assessments_deleted >= 0);

alter table internal.retention_purge_runs
  drop constraint retention_purge_runs_target_check,
  add constraint retention_purge_runs_target_check
    check (target in ('agent_traces', 'copilot_observability', 'human_tasks', 'readiness_assessments'));

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
  readiness_assessments_deleted bigint := 0;
begin
  if p_target is null or p_target not in (
    'agent_traces', 'copilot_observability', 'human_tasks', 'readiness_assessments'
  ) then
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
      when 'readiness_assessments' then
        select internal.purge_expired_readiness_assessments()
          into readiness_assessments_deleted;
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
    human_tasks_deleted,
    readiness_assessments_deleted
  ) values (
    p_target,
    'succeeded',
    run_started_at,
    clock_timestamp(),
    agent_traces_deleted,
    conversation_turns_deleted,
    cost_records_deleted,
    events_deleted,
    human_tasks_deleted,
    readiness_assessments_deleted
  )
  returning id into run_id;

  return run_id;
end;
$$;

create or replace view internal.retention_purge_health
with (security_invoker = true)
as
with targets(target) as (
  values
    ('agent_traces'::text),
    ('copilot_observability'::text),
    ('human_tasks'::text),
    ('readiness_assessments'::text)
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

select cron.schedule(
  'visepanda-purge-readiness-assessments',
  '40 2 * * *',
  $cron$select internal.run_retention_purge('readiness_assessments');$cron$
);
