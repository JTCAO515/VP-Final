begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.partners'::regclass),
  'partners has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.outbound_clicks'::regclass),
  'outbound clicks has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.events'::regclass),
  'telemetry events has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.human_tasks'::regclass),
  'human tasks has row level security enabled'
);

select is(
  has_table_privilege('anon', 'public.partners', 'select'),
  false,
  'anon cannot read partner configuration'
);
select is(
  has_table_privilege('authenticated', 'public.partners', 'select'),
  false,
  'authenticated users cannot read partner configuration'
);
select is(
  has_table_privilege('anon', 'public.outbound_clicks', 'select'),
  false,
  'anon cannot read affiliate click history'
);
select is(
  has_table_privilege('authenticated', 'public.outbound_clicks', 'select'),
  false,
  'authenticated users cannot read affiliate click history'
);
select is(
  has_table_privilege('anon', 'public.events', 'select'),
  false,
  'anon cannot read telemetry events'
);
select is(
  has_table_privilege('authenticated', 'public.events', 'select'),
  false,
  'authenticated users cannot read telemetry events'
);
select is(
  has_table_privilege('anon', 'public.human_tasks', 'select'),
  false,
  'anon cannot read human help requests'
);
select is(
  has_table_privilege('authenticated', 'public.human_tasks', 'select'),
  false,
  'authenticated users cannot read human help requests directly'
);
select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('partners', 'outbound_clicks', 'events', 'human_tasks')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'operational tables have no direct Data API grants'
);

select is(
  has_schema_privilege('anon', 'internal', 'usage'),
  false,
  'anon cannot use the internal schema'
);
select is(
  has_schema_privilege('authenticated', 'internal', 'usage'),
  false,
  'authenticated users cannot use the internal schema'
);
select ok(
  to_regclass('public.trust_funnel_daily') is null,
  'trust funnel aggregate is not exposed from public'
);
select ok(
  to_regclass('internal.trust_funnel_daily') is not null,
  'trust funnel aggregate is stored in the internal schema'
);
select is(
  has_table_privilege('anon', 'internal.trust_funnel_daily', 'select'),
  false,
  'anon cannot read the trust funnel aggregate'
);
select is(
  has_table_privilege('authenticated', 'internal.trust_funnel_daily', 'select'),
  false,
  'authenticated users cannot read the trust funnel aggregate'
);

select * from finish();
rollback;
