begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.agent_runs (id, anon_id, status, expires_at)
values
  (
    '19000000-0000-4000-8000-000000000001',
    'cost-contract-priced',
    'succeeded',
    now() + interval '30 days'
  ),
  (
    '19000000-0000-4000-8000-000000000002',
    'cost-contract-unpriced',
    'succeeded',
    now() + interval '30 days'
  );

insert into public.llm_call_costs (
  agent_run_id,
  anon_id,
  attempt_index,
  provider,
  model,
  effort,
  status,
  input_tokens,
  cached_input_tokens,
  output_tokens,
  input_price_per_million_usd,
  cached_input_price_per_million_usd,
  output_price_per_million_usd,
  cost_usd,
  fallback_triggered,
  latency_ms,
  retention_expires_at
) values
  (
    '19000000-0000-4000-8000-000000000001',
    'cost-contract-priced',
    1,
    'contract-provider',
    'priced-model',
    'medium',
    'succeeded',
    100,
    40,
    20,
    1,
    0.25,
    2,
    0.00011000,
    true,
    120,
    now() + interval '400 days'
  ),
  (
    '19000000-0000-4000-8000-000000000002',
    'cost-contract-unpriced',
    1,
    'contract-provider',
    'unpriced-model',
    'high',
    'succeeded',
    50,
    0,
    10,
    0,
    0,
    0,
    0,
    false,
    180,
    now() + interval '400 days'
  );

select is(
  (select cached_input_tokens from internal.copilot_cost_daily where day = current_date),
  40::bigint,
  'daily cost summary includes cached input tokens'
);
select is(
  round((select cache_hit_rate from internal.copilot_cost_daily where day = current_date), 4),
  0.2667::numeric,
  'daily cache-hit rate divides cached input by total input tokens'
);
select is(
  (select cached_input_tokens from internal.copilot_cost_by_model_daily where model = 'priced-model'),
  40::bigint,
  'model cost summary includes cached input tokens'
);
select is(
  round(
    (select cache_hit_rate from internal.copilot_cost_by_identity_daily
      where identity_id = 'cost-contract-priced'),
    2
  ),
  0.40::numeric,
  'identity summary exposes the cache-hit rate to the private Ops consumer'
);
select is(
  (select count(*) from internal.copilot_cost_reconciliation_health),
  1::bigint,
  'reconciliation health includes only token-bearing calls with all prices missing'
);
select is(
  (select model from internal.copilot_cost_reconciliation_health),
  'unpriced-model',
  'reconciliation health identifies the affected model without conversation content'
);
select is(
  has_table_privilege('anon', 'internal.copilot_cost_reconciliation_health', 'select'),
  false,
  'anonymous clients cannot read cost reconciliation health'
);
select is(
  has_table_privilege('authenticated', 'internal.copilot_cost_daily', 'select'),
  false,
  'traveler sessions cannot read aggregate costs directly'
);

insert into public.events (
  anon_id,
  surface,
  action,
  entity_type,
  entity_id,
  props_jsonb,
  retention_expires_at
) values (
  'cost-contract-priced',
  'server',
  'daily_budget_exceeded',
  'llm_daily_budget',
  current_date::text,
  '{"budgetUsd":"1.00","observedCostUsd":"1.25"}'::jsonb,
  now() + interval '180 days'
);

select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, entity_id, retention_expires_at
    ) values (
      'cost-contract-unpriced', 'server', 'daily_budget_exceeded',
      'llm_daily_budget', current_date::text, now() + interval '180 days'
    )$$,
  '23505',
  null,
  'daily budget warning is idempotent for one UTC day'
);
select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, entity_id
    ) values (
      'cost-contract-unpriced', 'server', 'daily_budget_exceeded',
      'llm_daily_budget', (current_date + 1)::text
    )$$,
  '23514',
  null,
  'daily budget warning requires a future retention deadline'
);
select is(
  (select count(*) from public.events where action = 'daily_budget_exceeded'),
  1::bigint,
  'exactly one daily budget event remains after a duplicate attempt'
);
select is(
  (select props_jsonb ->> 'budgetUsd' from public.events where action = 'daily_budget_exceeded'),
  '1.00',
  'budget event stores a fixed-point threshold snapshot'
);
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'internal'
      and table_name like 'copilot_cost%'
      and column_name in ('user_message', 'assistant_envelope_jsonb', 'api_key', 'cookie', 'signature')),
  0::bigint,
  'private cost views expose no conversation or credential material'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'events'
      and indexname = 'events_daily_budget_exceeded_day_unique'
  ),
  'daily budget event uniqueness is enforced by a partial index'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'internal'
      and table_name = 'copilot_cost_daily'
      and column_name = 'cache_hit_rate'
  ),
  'daily cost summary publishes the cache-hit rate contract'
);

select * from finish();
rollback;
