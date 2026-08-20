begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select ok(
  exists (select 1 from pg_constraint where conname = 'events_exactly_one_identity_check'),
  'events require exactly one trusted identity'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'events_registered_action_check'),
  'events accept only registered actions'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'events_props_object_check'),
  'events require object-shaped properties'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'events_outbound_continuity_check'),
  'outbound events require a partner and durable click id'
);
select has_index('public', 'events', 'events_user_created_idx', 'user event lookup is indexed');
select has_index('public', 'events', 'events_click_created_idx', 'click continuity lookup is indexed');

select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'web', 'unregistered_action', 'guide', now() + interval '180 days'
    )$$,
  '23514',
  null,
  'unregistered actions cannot enter the durable event ledger'
);
select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'web', 'outbound_clicked', 'outbound_click', now() + interval '180 days'
    )$$,
  '23514',
  null,
  'outbound events cannot omit partner and click id'
);
select lives_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, entity_id, props_jsonb, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'web', 'rescue_started', 'rescue_route',
      'payment_problem', '{"category":"payment_problem"}'::jsonb,
      now() + interval '180 days'
    )$$,
  'registered Rescue start metadata may enter the durable ledger'
);
select lives_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, entity_id, props_jsonb, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'web', 'rescue_route_selected', 'rescue_route',
      'payment_problem', '{"category":"payment_problem","primaryActionKind":"unavailable"}'::jsonb,
      now() + interval '180 days'
    )$$,
  'registered Rescue route metadata may enter the durable ledger'
);
select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'web', 'rescue_freeform_narrative', 'rescue_route', now() + interval '180 days'
    )$$,
  '23514',
  null,
  'unregistered Rescue narrative actions cannot enter the durable ledger'
);
select lives_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, entity_id, props_jsonb, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'web', 'arrival_pack_downloaded', 'arrival_pack',
      'trip-123', '{"packVersion":1,"firstDayBlockCount":2,"reviewedAddressCount":0,"readinessIncluded":true}'::jsonb,
      now() + interval '180 days'
    )$$,
  'registered Arrival Pack counters may enter the durable ledger'
);
select throws_ok(
  $$insert into public.events (
      anon_id, surface, action, entity_type, retention_expires_at
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'web', 'arrival_pack_full_contents', 'arrival_pack', now() + interval '180 days'
    )$$,
  '23514',
  null,
  'unregistered Arrival Pack content actions cannot enter the durable ledger'
);

insert into public.events (
  anon_id, surface, action, entity_type, entity_id, partner, click_id, props_jsonb, created_at, retention_expires_at
) values
  (
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'web', 'guide_viewed', 'guide',
    'payment-guide', null, null, '{"city":"Shanghai"}'::jsonb, now() - interval '1 day', now() + interval '179 days'
  ),
  (
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'web', 'guide_viewed', 'guide',
    'payment-guide', null, null, '{"city":"Shanghai"}'::jsonb, now(), now() + interval '180 days'
  ),
  (
    'ccccccccccccccccccccccccccccccccccccccccccc', 'server', 'outbound_clicked', 'outbound_click',
    '10000000-0000-4000-8000-000000000401', 'tripcom', '10000000-0000-4000-8000-000000000401', '{"city":"Shanghai","category":"hotel"}'::jsonb,
    now(), now() + interval '180 days'
  ),
  (
    'ccccccccccccccccccccccccccccccccccccccccccc', 'server', 'partner_redirected', 'outbound_click',
    '10000000-0000-4000-8000-000000000401', 'tripcom', '10000000-0000-4000-8000-000000000401', '{"city":"Shanghai","category":"hotel"}'::jsonb,
    now(), now() + interval '180 days'
  ),
  (
    'ddddddddddddddddddddddddddddddddddddddddddd', 'web', 'task_submitted', 'human_task',
    '10000000-0000-4000-8000-000000000402', null, null, '{"city":"Shanghai","kind":"call_restaurant"}'::jsonb,
    now(), now() + interval '180 days'
  );

select has_view('internal', 'phase0_funnel_daily', 'Phase 0 funnel view exists');
select has_view('internal', 'phase0_outbound_daily', 'Phase 0 outbound view exists');
select has_view('internal', 'phase0_human_help_daily', 'Phase 0 Human Help view exists');
select is(
  (select repeat_visitor_count from internal.phase0_funnel_daily where day = current_date),
  1::bigint,
  'funnel view counts a returning pseudonymous visitor'
);
select is(
  (select continuous_click_count from internal.phase0_outbound_daily where day = current_date and partner = 'tripcom'),
  1::bigint,
  'outbound view measures a click that reached a partner redirect'
);
select is(
  (select task_submitted_count from internal.phase0_human_help_daily where day = current_date and city = 'Shanghai'),
  1::bigint,
  'Human Help view measures task submissions without task content'
);
select is(
  has_table_privilege('anon', 'internal.phase0_funnel_daily', 'select'),
  false,
  'anonymous clients cannot read the private funnel view'
);
select is(
  has_table_privilege('authenticated', 'internal.phase0_outbound_daily', 'select'),
  false,
  'authenticated clients cannot read the private outbound view'
);
select is(
  has_table_privilege('anon', 'internal.phase0_human_help_daily', 'select'),
  false,
  'anonymous clients cannot read the private Human Help view'
);
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'internal'
      and table_name in ('phase0_funnel_daily', 'phase0_outbound_daily', 'phase0_human_help_daily')
      and column_name in ('user_id', 'anon_id', 'email', 'contact', 'prompt', 'message', 'response', 'api_key', 'cookie', 'signature')
  ),
  0::bigint,
  'Phase 0 views expose aggregates and dimensions only'
);

select * from finish();
rollback;
