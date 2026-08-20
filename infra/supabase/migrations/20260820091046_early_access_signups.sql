create table public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale text not null default 'en',
  source text not null default 'landing',
  ip_hash text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  retention_expires_at timestamptz not null,
  constraint early_access_signups_email_check
    check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  constraint early_access_signups_locale_check
    check (locale ~ '^[A-Za-z0-9-]{2,16}$'),
  constraint early_access_signups_source_check
    check (source ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint early_access_signups_ip_hash_check
    check (ip_hash ~ '^[a-f0-9]{64}$'),
  constraint early_access_signups_user_agent_check
    check (user_agent is null or char_length(user_agent) between 1 and 512),
  constraint early_access_signups_retention_check
    check (
      retention_expires_at > created_at
      and retention_expires_at <= created_at + interval '365 days'
    )
);

create unique index early_access_signups_email_unique on public.early_access_signups (email);
create index early_access_signups_retention_expires_idx
  on public.early_access_signups (retention_expires_at);

alter table public.early_access_signups enable row level security;
revoke all on table public.early_access_signups from public, anon, authenticated;

comment on table public.early_access_signups is
  'Private Early Access opt-in records. Stores a normalized email plus an HMAC IP digest for abuse control; never a raw IP, credential, cookie, or signature. Records expire within 365 days.';

create or replace function internal.purge_expired_early_access_signups()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.early_access_signups
  where retention_expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function internal.purge_expired_early_access_signups() from public, anon, authenticated;

alter table internal.retention_purge_runs
  add column early_access_signups_deleted bigint not null default 0
    check (early_access_signups_deleted >= 0);

alter table internal.retention_purge_runs
  drop constraint retention_purge_runs_target_check;
alter table internal.retention_purge_runs
  add constraint retention_purge_runs_target_check
    check (target in ('agent_traces', 'copilot_observability', 'human_tasks', 'readiness_assessments', 'early_access_signups'));

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
  early_access_signups_deleted bigint := 0;
begin
  if p_target is null or p_target not in (
    'agent_traces', 'copilot_observability', 'human_tasks', 'readiness_assessments', 'early_access_signups'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported retention purge target';
  end if;

  begin
    case p_target
      when 'agent_traces' then
        select internal.purge_expired_agent_traces()::bigint into agent_traces_deleted;
      when 'copilot_observability' then
        select result.conversation_turns_deleted::bigint, result.cost_records_deleted::bigint, result.events_deleted::bigint
          into conversation_turns_deleted, cost_records_deleted, events_deleted
        from internal.purge_expired_copilot_observability() as result;
      when 'human_tasks' then
        select internal.purge_expired_human_tasks() into human_tasks_deleted;
      when 'readiness_assessments' then
        select internal.purge_expired_readiness_assessments() into readiness_assessments_deleted;
      when 'early_access_signups' then
        select internal.purge_expired_early_access_signups() into early_access_signups_deleted;
    end case;
  exception when others then
    insert into internal.retention_purge_runs (target, status, started_at, completed_at, error_class)
    values (p_target, 'failed', run_started_at, clock_timestamp(), sqlstate)
    returning id into run_id;
    return run_id;
  end;

  insert into internal.retention_purge_runs (
    target, status, started_at, completed_at, agent_traces_deleted, conversation_turns_deleted,
    cost_records_deleted, events_deleted, human_tasks_deleted, readiness_assessments_deleted,
    early_access_signups_deleted
  ) values (
    p_target, 'succeeded', run_started_at, clock_timestamp(), agent_traces_deleted,
    conversation_turns_deleted, cost_records_deleted, events_deleted, human_tasks_deleted,
    readiness_assessments_deleted, early_access_signups_deleted
  ) returning id into run_id;
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
    ('readiness_assessments'::text),
    ('early_access_signups'::text)
),
last_runs as (
  select distinct on (target) target, status as last_status, completed_at as last_completed_at
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
        select 1 from internal.retention_purge_runs later_success
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
  'visepanda-purge-early-access-signups',
  '50 2 * * *',
  $cron$select internal.run_retention_purge('early_access_signups');$cron$
);
