begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('33700000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'visepod-grant-ops@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now());

select ok(exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'visepod_provisioning_grants'), 'private provisioning grants table exists');
select lives_ok($$insert into public.visepod_provisioning_grants (token_digest, ops_user_id, environment, issued_at, expires_at)
  values (repeat('a', 64), '33700000-0000-4000-8000-000000000001', 'development', now(), now() + interval '8 hours')$$, 'one exact eight-hour development grant is accepted');
select throws_ok($$insert into public.visepod_provisioning_grants (token_digest, ops_user_id, environment, issued_at, expires_at)
  values (repeat('b', 64), '33700000-0000-4000-8000-000000000001', 'development', now(), now() + interval '7 hours')$$, '23514', null, 'grant lifetime cannot deviate from eight hours');
select throws_ok($$insert into public.visepod_provisioning_grants (token_digest, ops_user_id, environment, issued_at, expires_at)
  values (repeat('c', 64), '33700000-0000-4000-8000-000000000001', 'staging', now(), now() + interval '8 hours')$$, '23514', null, 'grant environment is closed to development or production');
select ok((select relrowsecurity from pg_class where oid = 'public.visepod_provisioning_grants'::regclass), 'grant rows enforce RLS');
select is(has_table_privilege('anon', 'public.visepod_provisioning_grants', 'select'), false, 'anon cannot read grants');
select is(has_table_privilege('authenticated', 'public.visepod_provisioning_grants', 'select'), false, 'authenticated cannot read grants');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'visepod_provisioning_grants' and column_name in ('token', 'raw_token', 'token_value', 'device_secret', 'wifi_password')), 0, 'grant table stores no raw token or device credential column');

select * from finish();
rollback;
