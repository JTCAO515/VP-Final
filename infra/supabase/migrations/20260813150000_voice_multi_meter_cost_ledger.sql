-- ADR-0018: additive multi-meter extension; existing token fields keep their frozen meaning.
alter table public.llm_call_costs
  add column call_kind text not null default 'llm',
  add column metering_unit text not null default 'token',
  add column quantity numeric(20, 8) not null default 0,
  add column unit_price_per_million_usd numeric(14, 8) not null default 0,
  add column device_correlation_id uuid;

alter table public.llm_call_costs
  add constraint llm_call_costs_call_kind_check check (call_kind in ('llm', 'stt', 'tts')),
  add constraint llm_call_costs_metering_unit_check check (metering_unit in ('token', 'audio_second', 'character')),
  add constraint llm_call_costs_quantity_check check (quantity >= 0 and unit_price_per_million_usd >= 0);

alter table public.llm_call_costs drop constraint llm_call_costs_agent_attempt_unique;
create unique index llm_call_costs_agent_attempt_call_kind_unique
  on public.llm_call_costs(agent_run_id, attempt_index, call_kind);
create index llm_call_costs_device_created_idx
  on public.llm_call_costs(device_correlation_id, created_at desc)
  where device_correlation_id is not null;

create or replace view internal.copilot_cost_by_metering_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  call_kind,
  metering_unit,
  count(*) as call_count,
  sum(quantity) as quantity,
  sum(cost_usd) as cost_usd
from public.llm_call_costs
where retention_expires_at > now()
group by 1, 2, 3;

create or replace view internal.copilot_cost_by_device_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  device_correlation_id,
  call_kind,
  metering_unit,
  count(*) as call_count,
  sum(quantity) as quantity,
  sum(cost_usd) as cost_usd
from public.llm_call_costs
where retention_expires_at > now()
  and device_correlation_id is not null
group by 1, 2, 3, 4;

revoke all on table internal.copilot_cost_by_metering_daily from public, anon, authenticated;
revoke all on table internal.copilot_cost_by_device_daily from public, anon, authenticated;

comment on column public.llm_call_costs.device_correlation_id is
  'Nullable server-issued opaque UUID for future authenticated device aggregation. No FK, serial, credential, fingerprint, or user data.';
comment on column public.llm_call_costs.quantity is
  'Immutable billed quantity for the metering_unit. Existing LLM rows retain frozen token price fields and default to zero generic quantity.';
