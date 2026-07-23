begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.llm_call_costs'::regclass
      and contype = 'f'
      and conname = 'llm_call_costs_agent_run_id_fkey'
  ),
  0::bigint,
  'cost rows no longer cascade with Agent Run deletion'
);
select has_trigger(
  'public',
  'llm_call_costs',
  'llm_call_costs_agent_run_lifecycle',
  'cost rows enforce their Agent Run lifecycle at write time'
);
select is(
  has_function_privilege(
    'anon',
    'internal.enforce_llm_call_cost_agent_run_lifecycle()',
    'execute'
  ),
  false,
  'anonymous clients cannot execute the lifecycle trigger function'
);
select is(
  has_function_privilege(
    'authenticated',
    'internal.enforce_llm_call_cost_agent_run_lifecycle()',
    'execute'
  ),
  false,
  'authenticated clients cannot execute the lifecycle trigger function'
);

insert into public.agent_runs (id, anon_id, status, expires_at)
values
  ('24000000-0000-4000-8000-000000000001', 'lifecycle-current', 'succeeded', now() + interval '30 days'),
  ('24000000-0000-4000-8000-000000000002', 'lifecycle-other', 'succeeded', now() + interval '30 days');

insert into public.llm_call_costs (
  id, agent_run_id, anon_id, attempt_index, provider, model, effort, status,
  input_tokens, output_tokens, input_price_per_million_usd,
  output_price_per_million_usd, cost_usd, fallback_triggered, latency_ms,
  retention_expires_at
) values (
  '24000000-0000-4000-8000-000000000101',
  '24000000-0000-4000-8000-000000000001',
  'lifecycle-current', 1, 'provider', 'configured-model', 'medium', 'succeeded',
  100, 20, 1.00, 2.00, 0.00014000, false, 500, now() + interval '400 days'
);

select is(
  (
    select agent_run_id
    from public.llm_call_costs
    where id = '24000000-0000-4000-8000-000000000101'
  ),
  '24000000-0000-4000-8000-000000000001'::uuid,
  'a cost row can be inserted for an existing Agent Run'
);
select throws_ok(
  $$insert into public.llm_call_costs (
      agent_run_id, anon_id, attempt_index, provider, model, effort, status,
      input_tokens, output_tokens, input_price_per_million_usd,
      output_price_per_million_usd, cost_usd, fallback_triggered, latency_ms,
      retention_expires_at
    ) values (
      '24000000-0000-4000-8000-000000000099', 'lifecycle-orphan', 1,
      'provider', 'configured-model', 'medium', 'succeeded', 0, 0, 0, 0, 0,
      false, 0, now() + interval '400 days'
    )$$,
  '23503',
  null,
  'an orphan cost row is rejected at insert time'
);
select throws_ok(
  $$update public.llm_call_costs
      set agent_run_id = '24000000-0000-4000-8000-000000000002'
      where id = '24000000-0000-4000-8000-000000000101'$$,
  '23514',
  null,
  'a cost row cannot change its Agent Run correlation id'
);

delete from public.agent_runs
where id = '24000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.llm_call_costs
    where id = '24000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'deleting an Agent Run does not delete its cost row'
);
select is(
  (
    select agent_run_id
    from public.llm_call_costs
    where id = '24000000-0000-4000-8000-000000000101'
  ),
  '24000000-0000-4000-8000-000000000001'::uuid,
  'the historical opaque Agent Run id remains on the cost row'
);
select ok(
  (
    select retention_expires_at > now() + interval '399 days'
    from public.llm_call_costs
    where id = '24000000-0000-4000-8000-000000000101'
  ),
  'the cost row keeps its independent 400-day retention deadline'
);

insert into public.agent_runs (id, anon_id, status, expires_at)
values (
  '24000000-0000-4000-8000-000000000003',
  'lifecycle-trace-purge',
  'succeeded',
  now() - interval '1 second'
);
insert into public.llm_call_costs (
  id, agent_run_id, anon_id, attempt_index, provider, model, effort, status,
  input_tokens, output_tokens, input_price_per_million_usd,
  output_price_per_million_usd, cost_usd, fallback_triggered, latency_ms,
  retention_expires_at
) values (
  '24000000-0000-4000-8000-000000000103',
  '24000000-0000-4000-8000-000000000003',
  'lifecycle-trace-purge', 1, 'provider', 'configured-model', 'medium', 'succeeded',
  100, 20, 1.00, 2.00, 0.00014000, false, 500, now() + interval '400 days'
);

select is(
  internal.purge_expired_agent_traces(),
  1,
  'the trace purge removes the expired Agent Run'
);
select is(
  (
    select count(*)
    from public.llm_call_costs
    where id = '24000000-0000-4000-8000-000000000103'
  ),
  1::bigint,
  'the trace purge preserves the unexpired cost row'
);

insert into public.agent_runs (id, anon_id, status, expires_at)
values (
  '24000000-0000-4000-8000-000000000004',
  'lifecycle-cost-purge',
  'succeeded',
  now() + interval '30 days'
);
insert into public.llm_call_costs (
  id, agent_run_id, anon_id, attempt_index, provider, model, effort, status,
  input_tokens, output_tokens, input_price_per_million_usd,
  output_price_per_million_usd, cost_usd, fallback_triggered, latency_ms,
  created_at, retention_expires_at
) values (
  '24000000-0000-4000-8000-000000000104',
  '24000000-0000-4000-8000-000000000004',
  'lifecycle-cost-purge', 1, 'provider', 'configured-model', 'medium', 'succeeded',
  100, 20, 1.00, 2.00, 0.00014000, false, 500,
  now() - interval '401 days', now() - interval '1 day'
);

select lives_ok(
  $$select * from internal.purge_expired_copilot_observability()$$,
  'the observability purge runs independently of the trace purge'
);
select is(
  (
    select count(*)
    from public.llm_call_costs
    where id = '24000000-0000-4000-8000-000000000104'
  ),
  0::bigint,
  'the cost purge removes a cost row only at its own deadline'
);
select is(
  (
    select count(*)
    from public.llm_call_costs
    where id in (
      '24000000-0000-4000-8000-000000000101',
      '24000000-0000-4000-8000-000000000103'
    )
  ),
  2::bigint,
  'the cost purge preserves cost rows whose own deadlines are in the future'
);

select * from finish();
rollback;
