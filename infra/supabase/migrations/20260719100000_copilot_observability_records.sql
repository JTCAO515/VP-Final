create table public.copilot_conversation_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  user_id uuid references public.users(id) on delete cascade,
  anon_id text,
  status text not null check (status in ('succeeded', 'failed')),
  user_message text not null check (btrim(user_message) <> '' and char_length(user_message) <= 12000),
  assistant_envelope_jsonb jsonb,
  city_intent text check (city_intent is null or (btrim(city_intent) <> '' and char_length(city_intent) <= 80)),
  redaction_classes_jsonb jsonb not null default '[]'::jsonb
    check (jsonb_typeof(redaction_classes_jsonb) = 'array'),
  failure_class text check (failure_class is null or (btrim(failure_class) <> '' and char_length(failure_class) <= 80)),
  retention_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint copilot_conversation_turns_exactly_one_identity_check
    check (num_nonnulls(user_id, anon_id) = 1),
  constraint copilot_conversation_turns_result_check
    check (
      (status = 'succeeded' and assistant_envelope_jsonb is not null and failure_class is null)
      or (status = 'failed' and assistant_envelope_jsonb is null and failure_class is not null)
    ),
  constraint copilot_conversation_turns_retention_check
    check (retention_expires_at > created_at)
);

create unique index copilot_conversation_turns_agent_run_unique
  on public.copilot_conversation_turns(agent_run_id)
  where agent_run_id is not null;
create index copilot_conversation_turns_user_created_idx
  on public.copilot_conversation_turns(user_id, created_at desc)
  where user_id is not null;
create index copilot_conversation_turns_anon_created_idx
  on public.copilot_conversation_turns(anon_id, created_at desc)
  where anon_id is not null;
create index copilot_conversation_turns_session_created_idx
  on public.copilot_conversation_turns(session_id, created_at);

create table public.llm_call_costs (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  anon_id text,
  attempt_index integer not null check (attempt_index > 0),
  provider text not null check (btrim(provider) <> '' and char_length(provider) <= 80),
  model text not null check (btrim(model) <> '' and char_length(model) <= 160),
  effort text not null check (effort in ('low', 'medium', 'high')),
  status text not null check (status in ('succeeded', 'failed')),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  input_price_per_million_usd numeric(14, 8) not null check (input_price_per_million_usd >= 0),
  output_price_per_million_usd numeric(14, 8) not null check (output_price_per_million_usd >= 0),
  cost_usd numeric(14, 8) not null check (cost_usd >= 0),
  fallback_triggered boolean not null default false,
  latency_ms integer not null check (latency_ms >= 0),
  failure_class text check (failure_class is null or (btrim(failure_class) <> '' and char_length(failure_class) <= 80)),
  retention_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint llm_call_costs_exactly_one_identity_check
    check (num_nonnulls(user_id, anon_id) = 1),
  constraint llm_call_costs_failure_check
    check (
      (status = 'succeeded' and failure_class is null)
      or (status = 'failed' and failure_class is not null)
    ),
  constraint llm_call_costs_retention_check
    check (retention_expires_at > created_at),
  constraint llm_call_costs_agent_attempt_unique unique (agent_run_id, attempt_index)
);

create index llm_call_costs_user_created_idx
  on public.llm_call_costs(user_id, created_at desc)
  where user_id is not null;
create index llm_call_costs_anon_created_idx
  on public.llm_call_costs(anon_id, created_at desc)
  where anon_id is not null;
create index llm_call_costs_model_created_idx
  on public.llm_call_costs(provider, model, created_at desc);

alter table public.events
  alter column anon_id drop not null,
  add column retention_expires_at timestamptz,
  add constraint events_at_least_one_identity_check
    check (num_nonnulls(user_id, anon_id) >= 1),
  add constraint events_copilot_retention_check
    check (
      action not in (
        'session_started',
        'turn_completed',
        'anon_limit_hit',
        'rate_limited',
        'register_prompt_shown',
        'fallback_triggered',
        'model_failure'
      )
      or (retention_expires_at is not null and retention_expires_at > created_at)
    );

create index events_retention_expires_idx
  on public.events(retention_expires_at)
  where retention_expires_at is not null;

alter table public.copilot_conversation_turns enable row level security;
alter table public.llm_call_costs enable row level security;
revoke all on table public.copilot_conversation_turns from public, anon, authenticated;
revoke all on table public.llm_call_costs from public, anon, authenticated;

comment on table public.copilot_conversation_turns is
  'Server-only redacted Copilot turns. Never store raw PII, credentials, cookies, signatures, or provider payloads.';
comment on table public.llm_call_costs is
  'Server-only per-attempt LLM cost ledger with immutable pricing snapshots; no provider payloads or credentials.';

create or replace view internal.copilot_cost_by_identity_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  case when user_id is not null then 'authenticated' else 'anonymous' end as identity_kind,
  coalesce(user_id::text, anon_id) as identity_id,
  count(*) as call_count,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(cost_usd) as cost_usd,
  count(*) filter (where fallback_triggered)::numeric / nullif(count(*), 0) as fallback_rate
from public.llm_call_costs
where retention_expires_at > now()
group by 1, 2, 3;

create or replace view internal.copilot_cost_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  count(*) as call_count,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(cost_usd) as cost_usd,
  count(*) filter (where fallback_triggered)::numeric / nullif(count(*), 0) as fallback_rate
from public.llm_call_costs
where retention_expires_at > now()
group by 1;

create or replace view internal.copilot_cost_by_model_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  provider,
  model,
  effort,
  count(*) as call_count,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(cost_usd) as cost_usd,
  count(*) filter (where fallback_triggered)::numeric / nullif(count(*), 0) as fallback_rate
from public.llm_call_costs
where retention_expires_at > now()
group by 1, 2, 3, 4;

create or replace view internal.copilot_conversation_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  count(*) as turn_count,
  count(distinct session_id) as session_count,
  count(*) filter (where status = 'succeeded') as succeeded_turns,
  count(*) filter (where status = 'failed') as failed_turns
from public.copilot_conversation_turns
where retention_expires_at > now()
group by 1;

revoke all on table internal.copilot_cost_by_identity_daily from public, anon, authenticated;
revoke all on table internal.copilot_cost_daily from public, anon, authenticated;
revoke all on table internal.copilot_cost_by_model_daily from public, anon, authenticated;
revoke all on table internal.copilot_conversation_daily from public, anon, authenticated;

create or replace function internal.purge_expired_copilot_observability()
returns table (conversation_turns_deleted integer, cost_records_deleted integer, events_deleted integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_turns integer;
  deleted_costs integer;
  deleted_events integer;
begin
  delete from public.copilot_conversation_turns where retention_expires_at <= now();
  get diagnostics deleted_turns = row_count;

  delete from public.llm_call_costs where retention_expires_at <= now();
  get diagnostics deleted_costs = row_count;

  delete from public.events where retention_expires_at is not null and retention_expires_at <= now();
  get diagnostics deleted_events = row_count;

  return query select deleted_turns, deleted_costs, deleted_events;
end;
$$;

revoke all on function internal.purge_expired_copilot_observability() from public, anon, authenticated;
