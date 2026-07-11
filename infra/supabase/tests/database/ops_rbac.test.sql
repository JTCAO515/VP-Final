begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'ops-rbac-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ops_memberships'::regclass),
  'Ops memberships has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ops_audit_events'::regclass),
  'Ops audit has row level security enabled'
);
select is(
  has_table_privilege('anon', 'public.ops_memberships', 'select'),
  false,
  'anon cannot read Ops memberships'
);
select is(
  has_table_privilege('authenticated', 'public.ops_memberships', 'select'),
  false,
  'authenticated users cannot read Ops memberships directly'
);
select is(
  has_table_privilege('anon', 'public.ops_audit_events', 'select'),
  false,
  'anon cannot read Ops audit evidence'
);
select is(
  has_table_privilege('authenticated', 'public.ops_audit_events', 'select'),
  false,
  'authenticated users cannot read Ops audit evidence directly'
);
select throws_ok(
  $$insert into public.ops_memberships (user_id, role)
    values ('40000000-0000-4000-8000-000000000001', 'superadmin')$$,
  '23514',
  'membership rejects roles outside the explicit matrix'
);
select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('ops_memberships', 'ops_audit_events')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'Ops authorization tables have no direct Data API grants'
);

select * from finish();
rollback;
