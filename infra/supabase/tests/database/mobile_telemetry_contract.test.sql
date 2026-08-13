begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select lives_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, entity_id, props_jsonb, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'mobile', 'tool_opened', 'tool', 'translation',
      '{"tool":"translation"}'::jsonb, now() + interval '180 days'
    )$$,
  'registered mobile Tool metadata may enter the durable ledger'
);
select lives_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, entity_id, props_jsonb, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'mobile', 'show_to_local_used', 'show_to_local',
      'restaurant', '{"category":"restaurant"}'::jsonb, now() + interval '180 days'
    )$$,
  'registered mobile Show to Local category metadata may enter the durable ledger'
);
select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, props_jsonb, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'mobile', 'mobile_raw_prompt', 'mobile_app',
      '{"prompt":"plan my private trip"}'::jsonb, now() + interval '180 days'
    )$$,
  '23514',
  null,
  'unregistered mobile raw-content events cannot enter the durable ledger'
);

select * from finish();
rollback;
