begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.copilot_conversation_turns'::regclass),
  'conversation turns have RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.llm_call_costs'::regclass),
  'cost records have RLS'
);
select is(
  has_table_privilege('anon', 'public.copilot_conversation_turns', 'select'),
  false,
  'anonymous clients cannot read conversations'
);
select is(
  has_table_privilege('authenticated', 'public.llm_call_costs', 'select'),
  false,
  'authenticated clients cannot read costs directly'
);

select throws_ok(
  $$insert into public.copilot_conversation_turns (
      session_id, user_id, anon_id, status, user_message, failure_class, retention_expires_at
    ) values (
      gen_random_uuid(), gen_random_uuid(), 'anonymous', 'failed', 'redacted', 'provider_error', now() + interval '30 days'
    )$$,
  '23514',
  null,
  'a conversation cannot carry two identities'
);
select throws_ok(
  $$insert into public.copilot_conversation_turns (
      session_id, anon_id, status, user_message, assistant_envelope_jsonb, retention_expires_at
    ) values (
      gen_random_uuid(), 'anonymous', 'succeeded', 'redacted', '{}'::jsonb, now() - interval '1 second'
    )$$,
  '23514',
  null,
  'a conversation requires a future retention deadline'
);
select throws_ok(
  $$insert into public.events (anon_id, surface, action, entity_type)
    values ('anonymous', 'server', 'turn_completed', 'copilot_turn')$$,
  '23514',
  null,
  'Copilot product events require retention'
);
select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, created_at, retention_expires_at
    ) values (
      'anonymous', 'server', 'turn_completed', 'copilot_turn', now(), now() - interval '1 second'
    )$$,
  '23514',
  null,
  'Copilot product events require a future retention deadline'
);
select throws_ok(
  $$insert into public.events (
      surface, action, entity_type, retention_expires_at
    ) values (
      'server', 'turn_completed', 'copilot_turn', now() + interval '30 days'
    )$$,
  '23514',
  null,
  'product events require a trusted identity'
);

insert into public.agent_runs (id, anon_id, status, expires_at)
values (
  '10000000-0000-4000-8000-000000000001',
  'anonymous',
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
  output_tokens,
  input_price_per_million_usd,
  output_price_per_million_usd,
  cost_usd,
  fallback_triggered,
  latency_ms,
  retention_expires_at
) values (
  '10000000-0000-4000-8000-000000000001',
  'anonymous',
  1,
  'provider',
  'configured-model',
  'medium',
  'succeeded',
  120,
  80,
  0.2,
  0.8,
  0.000088,
  false,
  820,
  now() + interval '30 days'
);

select is(
  (select call_count from internal.copilot_cost_daily where day = current_date),
  1::bigint,
  'daily cost view counts calls'
);
select is(
  (select cost_usd from internal.copilot_cost_daily where day = current_date),
  0.00008800::numeric,
  'daily cost view sums reconciled USD'
);
select is(
  (select call_count from internal.copilot_cost_by_model_daily where model = 'configured-model'),
  1::bigint,
  'model view groups calls'
);
select is(
  (select identity_kind from internal.copilot_cost_by_identity_daily where identity_id = 'anonymous'),
  'anonymous',
  'identity view exposes only the pseudonymous identity kind'
);

select is(
  has_table_privilege('anon', 'internal.copilot_cost_daily', 'select'),
  false,
  'anonymous clients cannot read aggregate costs'
);
select is(
  has_table_privilege('authenticated', 'internal.copilot_conversation_daily', 'select'),
  false,
  'authenticated clients cannot read conversation aggregates directly'
);
select is(
  has_function_privilege('anon', 'internal.purge_expired_copilot_observability()', 'execute'),
  false,
  'anonymous clients cannot purge observability data'
);
select is(
  has_function_privilege('authenticated', 'internal.purge_expired_copilot_observability()', 'execute'),
  false,
  'authenticated clients cannot purge observability data'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'copilot_conversation_turns'
      and column_name = 'retention_expires_at'
  ),
  'conversation rows require a retention deadline'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'llm_call_costs'
      and column_name = 'input_price_per_million_usd'
  ),
  'cost rows snapshot input pricing'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('copilot_conversation_turns', 'llm_call_costs')
      and column_name in ('api_key', 'cookie', 'signature', 'authorization')
  ),
  'persistence tables have no credential, cookie, or signature columns'
);
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'internal'
      and table_name like 'copilot_%'
      and column_name in ('user_message', 'assistant_envelope_jsonb')),
  0::bigint,
  'sanitized aggregate views expose no conversation content'
);

insert into public.agent_runs (id, anon_id, status, expires_at)
values (
  '10000000-0000-4000-8000-000000000002',
  'expired-anonymous',
  'failed',
  now() + interval '30 days'
);
insert into public.copilot_conversation_turns (
  session_id,
  agent_run_id,
  anon_id,
  status,
  user_message,
  failure_class,
  created_at,
  retention_expires_at
) values (
  gen_random_uuid(),
  '10000000-0000-4000-8000-000000000002',
  'expired-anonymous',
  'failed',
  'redacted',
  'provider_error',
  now() - interval '2 days',
  now() - interval '1 day'
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
  output_tokens,
  input_price_per_million_usd,
  output_price_per_million_usd,
  cost_usd,
  fallback_triggered,
  latency_ms,
  failure_class,
  created_at,
  retention_expires_at
) values (
  '10000000-0000-4000-8000-000000000002',
  'expired-anonymous',
  1,
  'provider',
  'configured-model',
  'medium',
  'failed',
  10,
  0,
  0.2,
  0.8,
  0.000002,
  false,
  100,
  'provider_error',
  now() - interval '2 days',
  now() - interval '1 day'
);
insert into public.events (
  anon_id,
  surface,
  action,
  entity_type,
  created_at,
  retention_expires_at
) values (
  'expired-anonymous',
  'server',
  'model_failure',
  'copilot_turn',
  now() - interval '2 days',
  now() - interval '1 day'
);

create temporary table purge_result as
select * from internal.purge_expired_copilot_observability();

select is(
  (select conversation_turns_deleted from purge_result),
  1,
  'purge removes expired conversation turns'
);
select is(
  (select cost_records_deleted from purge_result),
  1,
  'purge removes expired cost records'
);
select is(
  (select events_deleted from purge_result),
  1,
  'purge removes expired Copilot events'
);
select is(
  (select count(*) from public.llm_call_costs where anon_id = 'anonymous'),
  1::bigint,
  'purge preserves current cost records'
);

select * from finish();
rollback;
