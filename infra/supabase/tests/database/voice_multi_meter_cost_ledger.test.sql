begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_column('public', 'llm_call_costs', 'call_kind', 'cost rows distinguish LLM, STT, and TTS calls');
select has_column('public', 'llm_call_costs', 'metering_unit', 'cost rows retain the immutable unit');
select has_column('public', 'llm_call_costs', 'device_correlation_id', 'device aggregation uses an opaque nullable UUID');
select col_default_is('public', 'llm_call_costs', 'call_kind', 'llm', 'historical rows default to llm');
select col_default_is('public', 'llm_call_costs', 'metering_unit', 'token', 'historical rows default to token');

insert into public.agent_runs (id, anon_id, status, expires_at)
values ('29800000-0000-4000-8000-000000000001', 'voice-cost-fixture', 'succeeded', now() + interval '30 days');

insert into public.llm_call_costs (
  agent_run_id, anon_id, attempt_index, call_kind, metering_unit, quantity,
  unit_price_per_million_usd, device_correlation_id, provider, model, effort, status,
  input_tokens, output_tokens, input_price_per_million_usd, output_price_per_million_usd,
  cost_usd, fallback_triggered, latency_ms, retention_expires_at
) values
  ('29800000-0000-4000-8000-000000000001', 'voice-cost-fixture', 1, 'llm', 'token', 1200, 0,
   '29800000-0000-4000-8000-000000000100', 'fixture', 'llm', 'medium', 'succeeded', 1200, 0, 1, 0, 0.0012, false, 1, now() + interval '400 days'),
  ('29800000-0000-4000-8000-000000000001', 'voice-cost-fixture', 1, 'stt', 'audio_second', 12.5, 4,
   '29800000-0000-4000-8000-000000000100', 'fixture', 'stt', 'medium', 'succeeded', 0, 0, 0, 0, 0.00005, false, 1, now() + interval '400 days'),
  ('29800000-0000-4000-8000-000000000001', 'voice-cost-fixture', 1, 'tts', 'character', 240, 0.2,
   '29800000-0000-4000-8000-000000000100', 'fixture', 'tts', 'medium', 'succeeded', 0, 0, 0, 0, 0.000048, false, 1, now() + interval '400 days');

select is((select count(*) from public.llm_call_costs where agent_run_id = '29800000-0000-4000-8000-000000000001'), 3::bigint, 'one attempt can retain three independent billable calls');
select is((select count(*) from internal.copilot_cost_by_metering_daily where day = current_date), 3::bigint, 'private view aggregates all three metering units');
select is((select count(*) from internal.copilot_cost_by_device_daily where device_correlation_id = '29800000-0000-4000-8000-000000000100'), 3::bigint, 'private device view aggregates opaque correlation only');
select is(has_table_privilege('anon', 'internal.copilot_cost_by_device_daily', 'select'), false, 'anonymous clients cannot read device costs');
select throws_ok(
  $$insert into public.llm_call_costs (agent_run_id, anon_id, attempt_index, call_kind, metering_unit, quantity, unit_price_per_million_usd, provider, model, effort, status, input_tokens, output_tokens, input_price_per_million_usd, output_price_per_million_usd, cost_usd, latency_ms, retention_expires_at) values ('29800000-0000-4000-8000-000000000001', 'voice-cost-fixture', 2, 'stt', 'audio_second', -1, 1, 'fixture', 'bad', 'medium', 'succeeded', 0, 0, 0, 0, 0, 1, now() + interval '400 days')$$,
  '23514', null, 'negative metered quantity is rejected'
);
select is((select metering_unit from public.llm_call_costs where call_kind = 'llm' limit 1), 'token', 'legacy-compatible LLM meter remains token');

select * from finish();
rollback;
