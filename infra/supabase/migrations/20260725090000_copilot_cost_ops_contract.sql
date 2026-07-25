alter table public.events
  add constraint events_daily_budget_exceeded_retention_check
    check (
      action <> 'daily_budget_exceeded'
      or (retention_expires_at is not null and retention_expires_at > created_at)
    );

create unique index events_daily_budget_exceeded_day_unique
  on public.events (entity_id)
  where action = 'daily_budget_exceeded';

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
  count(*) filter (where fallback_triggered)::numeric / nullif(count(*), 0) as fallback_rate,
  sum(cached_input_tokens) as cached_input_tokens,
  coalesce(
    sum(cached_input_tokens)::numeric / nullif(sum(input_tokens), 0),
    0::numeric
  ) as cache_hit_rate
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
  count(*) filter (where fallback_triggered)::numeric / nullif(count(*), 0) as fallback_rate,
  sum(cached_input_tokens) as cached_input_tokens,
  coalesce(
    sum(cached_input_tokens)::numeric / nullif(sum(input_tokens), 0),
    0::numeric
  ) as cache_hit_rate
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
  count(*) filter (where fallback_triggered)::numeric / nullif(count(*), 0) as fallback_rate,
  sum(cached_input_tokens) as cached_input_tokens,
  coalesce(
    sum(cached_input_tokens)::numeric / nullif(sum(input_tokens), 0),
    0::numeric
  ) as cache_hit_rate
from public.llm_call_costs
where retention_expires_at > now()
group by 1, 2, 3, 4;

create or replace view internal.copilot_cost_reconciliation_health
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  agent_run_id,
  attempt_index,
  provider,
  model,
  effort,
  input_tokens,
  cached_input_tokens,
  output_tokens,
  created_at
from public.llm_call_costs
where retention_expires_at > now()
  and input_tokens + output_tokens > 0
  and input_price_per_million_usd = 0
  and cached_input_price_per_million_usd = 0
  and output_price_per_million_usd = 0;

revoke all on table internal.copilot_cost_by_identity_daily from public, anon, authenticated;
revoke all on table internal.copilot_cost_daily from public, anon, authenticated;
revoke all on table internal.copilot_cost_by_model_daily from public, anon, authenticated;
revoke all on table internal.copilot_cost_reconciliation_health from public, anon, authenticated;

comment on view internal.copilot_cost_reconciliation_health is
  'Private reconciliation queue for retained token-bearing calls whose three immutable price snapshots are all zero.';
