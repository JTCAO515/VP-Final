begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_column(
  'public',
  'llm_call_costs',
  'cached_input_tokens',
  'cost rows retain cached input token usage'
);
select has_column(
  'public',
  'llm_call_costs',
  'cached_input_price_per_million_usd',
  'cost rows snapshot cached input pricing'
);
select col_default_is(
  'public',
  'llm_call_costs',
  'cached_input_tokens',
  '0',
  'legacy cost rows default cached input tokens to zero'
);
select col_default_is(
  'public',
  'llm_call_costs',
  'cached_input_price_per_million_usd',
  '0',
  'legacy cost rows default cached input price to zero'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'llm_call_costs_cached_input_tokens_check'
      and conrelid = 'public.llm_call_costs'::regclass
  ),
  'cached input subset check is append-only and explicitly named'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'llm_call_costs_cached_input_price_per_million_usd_check'
      and conrelid = 'public.llm_call_costs'::regclass
  ),
  'cached input price check is append-only and explicitly named'
);

insert into public.agent_runs (id, anon_id, status, expires_at)
values (
  '10000000-0000-4000-8000-000000000101',
  'cache-contract-test',
  'succeeded',
  now() + interval '30 days'
);

select throws_ok(
  $$insert into public.llm_call_costs (
      agent_run_id, anon_id, attempt_index, provider, model, effort, status,
      input_tokens, cached_input_tokens, output_tokens,
      input_price_per_million_usd, cached_input_price_per_million_usd,
      output_price_per_million_usd, cost_usd, latency_ms, retention_expires_at
    ) values (
      '10000000-0000-4000-8000-000000000101', 'cache-contract-test', 1,
      'provider', 'model', 'medium', 'succeeded', 10, 11, 0,
      1, 0.1, 1, 0, 1, now() + interval '400 days'
    )$$,
  '23514',
  null,
  'cached input tokens cannot exceed total input tokens'
);
select throws_ok(
  $$insert into public.llm_call_costs (
      agent_run_id, anon_id, attempt_index, provider, model, effort, status,
      input_tokens, output_tokens, input_price_per_million_usd,
      cached_input_price_per_million_usd, output_price_per_million_usd,
      cost_usd, latency_ms, retention_expires_at
    ) values (
      '10000000-0000-4000-8000-000000000101', 'cache-contract-test', 1,
      'provider', 'model', 'medium', 'succeeded', 10, 0, 1, -0.1, 1,
      0, 1, now() + interval '400 days'
    )$$,
  '23514',
  null,
  'cached input price cannot be negative'
);
select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type
    ) values (
      'cache-contract-test', 'server', 'cost_pricing_missing', 'llm_call'
    )$$,
  '23514',
  null,
  'cost pricing missing events require a retention deadline'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'llm_call_costs'
      and column_name in ('api_key', 'cookie', 'signature', 'authorization')
  ),
  'cache pricing extension adds no secret, cookie, or signature columns'
);

select * from finish();
rollback;
