begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('33600000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'visepod-operator@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('33600000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'visepod-user-one@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('33600000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'visepod-user-two@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.users (id, email) values
  ('33600000-0000-4000-8000-000000000002', 'visepod-user-one@example.com'),
  ('33600000-0000-4000-8000-000000000003', 'visepod-user-two@example.com');

select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'visepod_device_bindings'),
  'VisePod bindings have a dedicated private table'
);
select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'visepod_binding_idempotency'),
  'VisePod idempotency has a dedicated private table'
);

insert into public.visepod_device_bindings (device_id, user_id, bound_by)
values (
  'device-001',
  '33600000-0000-4000-8000-000000000002',
  '33600000-0000-4000-8000-000000000001'
);

select is(
  (select state from public.visepod_device_bindings where device_id = 'device-001'),
  'active',
  'a first device assignment is active'
);

select throws_ok(
  $$insert into public.visepod_device_bindings (device_id, user_id, bound_by)
    values ('device-001', '33600000-0000-4000-8000-000000000003', '33600000-0000-4000-8000-000000000001')$$,
  '23505',
  null,
  'a device cannot have two active assignments'
);

update public.visepod_device_bindings
set state = 'revoked', revoked_at = now(), revoked_by = '33600000-0000-4000-8000-000000000001'
where device_id = 'device-001' and state = 'active';

select lives_ok(
  $$insert into public.visepod_device_bindings (device_id, user_id, bound_by)
    values ('device-001', '33600000-0000-4000-8000-000000000003', '33600000-0000-4000-8000-000000000001')$$,
  'a rebind preserves the revoked history row and creates one new active assignment'
);

select is(
  (select count(*)::integer from public.visepod_device_bindings where device_id = 'device-001'),
  2,
  'rebind history is retained rather than overwritten'
);

insert into public.visepod_binding_idempotency (
  idempotency_key, binding_id, command_digest, response_jsonb, retention_expires_at
) values (
  '33600000-0000-4000-8000-000000000010',
  (select id from public.visepod_device_bindings where device_id = 'device-001' and state = 'active'),
  repeat('a', 64),
  '{"outcome":"rebound"}'::jsonb,
  now() + interval '30 days'
);

select throws_ok(
  $$insert into public.visepod_binding_idempotency (
      idempotency_key, binding_id, command_digest, response_jsonb, retention_expires_at
    ) values (
      '33600000-0000-4000-8000-000000000010',
      (select id from public.visepod_device_bindings where device_id = 'device-001' and state = 'active'),
      repeat('b', 64),
      '{"outcome":"revoked"}'::jsonb,
      now() + interval '30 days'
    )$$,
  '23505',
  null,
  'the database rejects a reused idempotency key before a changed command can overwrite it'
);

select throws_ok(
  $$insert into public.visepod_device_bindings (device_id, user_id, state, bound_by)
    values ('device/invalid', '33600000-0000-4000-8000-000000000003', 'active', '33600000-0000-4000-8000-000000000001')$$,
  '23514',
  null,
  'the server binding table matches the protocol device-id character boundary'
);

select throws_ok(
  $$update public.visepod_device_bindings
    set state = 'revoked'
    where device_id = 'device-001' and state = 'active'$$,
  '23514',
  null,
  'a revoked assignment must retain both revocation timestamp and operator'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.visepod_device_bindings'::regclass),
  'VisePod bindings enforce row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.visepod_binding_idempotency'::regclass),
  'VisePod idempotency records enforce row-level security'
);
select is(
  has_table_privilege('anon', 'public.visepod_device_bindings', 'select'),
  false,
  'anon cannot read VisePod bindings'
);
select is(
  has_table_privilege('authenticated', 'public.visepod_binding_idempotency', 'select'),
  false,
  'authenticated users cannot read VisePod idempotency records'
);
select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'visepod_device_bindings'
      and column_name in ('token', 'token_hash', 'device_secret', 'wifi_password', 'email', 'session', 'reason')
  ),
  0,
  'the binding table has no credential or secret-bearing columns'
);

delete from public.users where id = '33600000-0000-4000-8000-000000000003';

select is(
  (select count(*)::integer from public.visepod_device_bindings where device_id = 'device-001' and state = 'active'),
  0,
  'user deletion cascades the active device assignment'
);
select is(
  (select count(*)::integer from public.visepod_binding_idempotency),
  0,
  'user deletion cascades idempotency records through the binding relationship'
);

select * from finish();
rollback;
