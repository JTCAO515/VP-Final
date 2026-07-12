alter table public.agent_runs
  alter column user_id drop not null,
  add column anon_id text,
  add column input_digest text,
  add column output_digest text,
  add column input_tokens integer not null default 0 check (input_tokens >= 0),
  add column output_tokens integer not null default 0 check (output_tokens >= 0),
  add column latency_ms integer not null default 0 check (latency_ms >= 0),
  add column attempts_jsonb jsonb not null default '[]'::jsonb,
  add column fallback_used boolean not null default false,
  add column validation_status text not null default 'passed'
    check (validation_status in ('passed', 'failed')),
  add column repair_count integer not null default 0 check (repair_count >= 0),
  add column failure_class text,
  add column expires_at timestamptz not null default (now() + interval '30 days'),
  add constraint agent_runs_at_most_one_identity_check
    check (num_nonnulls(user_id, anon_id) <= 1);

alter table public.tool_calls
  add column input_digest text,
  add column output_digest text,
  add column latency_ms integer not null default 0 check (latency_ms >= 0),
  add column failure_class text;

create index agent_runs_anon_created_idx
  on public.agent_runs(anon_id, created_at desc)
  where anon_id is not null;

comment on column public.agent_runs.input_jsonb is
  'Deprecated privacy boundary: runtime writers must leave this empty.';
comment on column public.agent_runs.output_jsonb is
  'Deprecated privacy boundary: runtime writers must leave this empty.';
comment on column public.agent_runs.error is
  'Deprecated privacy boundary: use normalized failure_class; do not store raw errors.';
comment on column public.tool_calls.input_jsonb is
  'Deprecated privacy boundary: runtime writers must leave this empty.';
comment on column public.tool_calls.output_jsonb is
  'Deprecated privacy boundary: runtime writers must leave this empty.';
comment on column public.tool_calls.error is
  'Deprecated privacy boundary: use normalized failure_class; do not store raw errors.';

update public.agent_runs set input_jsonb = '{}'::jsonb, output_jsonb = '{}'::jsonb, error = null;
update public.tool_calls set input_jsonb = '{}'::jsonb, output_jsonb = '{}'::jsonb, error = null;

drop policy if exists "agent_runs_read_own" on public.agent_runs;
drop policy if exists "agent_runs_insert_own" on public.agent_runs;
drop policy if exists "agent_runs_update_own" on public.agent_runs;
drop policy if exists "tool_calls_read_own_run" on public.tool_calls;
drop policy if exists "tool_calls_insert_own_run" on public.tool_calls;
drop policy if exists "tool_calls_update_own_run" on public.tool_calls;

revoke all on table public.agent_runs from anon, authenticated;
revoke all on table public.tool_calls from anon, authenticated;

comment on table public.agent_runs is
  'Server-only operational trace metadata. Retain 30 days; never store raw prompts, output, secrets, or narrative errors.';

create or replace function internal.purge_expired_agent_traces()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
begin
  delete from public.agent_runs where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function internal.purge_expired_agent_traces() from public, anon, authenticated;
