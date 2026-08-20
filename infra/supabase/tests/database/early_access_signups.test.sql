begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'early_access_signups', 'Private Early Access signup table exists');
select has_column('public', 'early_access_signups', 'email', 'Normalized email exists');
select has_column('public', 'early_access_signups', 'ip_hash', 'HMAC digest exists');
select has_column('public', 'early_access_signups', 'retention_expires_at', 'Retention deadline exists');
select has_index('public', 'early_access_signups', 'early_access_signups_email_unique', 'One row per normalized email');
select is(
  (select relrowsecurity from pg_class where oid = 'public.early_access_signups'::regclass),
  true,
  'Early Access records enforce RLS'
);
select is(has_table_privilege('anon', 'public.early_access_signups', 'select'), false, 'anon cannot read signups');
select is(has_table_privilege('authenticated', 'public.early_access_signups', 'insert'), false, 'authenticated cannot write signups');
select is(
  (select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'early_access_signups' and column_name in ('ip', 'raw_ip', 'api_key', 'cookie', 'signature')),
  0,
  'No raw IP or secret column exists'
);
select is(
  has_function_privilege('anon', 'internal.purge_expired_early_access_signups()', 'execute'),
  false,
  'Anonymous clients cannot execute the private signup purge'
);

select lives_ok(
  $$insert into public.early_access_signups (email, locale, source, ip_hash, created_at, retention_expires_at)
    values ('traveler@example.com', 'en', 'landing', repeat('a', 64), now() - interval '2 days', now() - interval '1 day')$$,
  'A normalized private signup with an internally consistent bounded deadline is accepted'
);
select throws_ok(
  $$insert into public.early_access_signups (email, locale, source, ip_hash, retention_expires_at)
    values ('Traveler@Example.com', 'en', 'landing', repeat('b', 64), now() + interval '180 days')$$,
  '23514', null, 'Non-normalized email is rejected'
);
select throws_ok(
  $$insert into public.early_access_signups (email, locale, source, ip_hash, retention_expires_at)
    values ('second@example.com', 'en', 'landing', repeat('c', 64), now() + interval '366 days')$$,
  '23514', null, 'Retention cannot exceed 365 days'
);

select internal.run_retention_purge('early_access_signups');
select is((select count(*)::integer from public.early_access_signups where email = 'traveler@example.com'), 0, 'Expired signup is purged');
select is(
  (select early_access_signups_deleted from internal.retention_purge_runs where target = 'early_access_signups' order by completed_at desc, id desc limit 1),
  1::bigint,
  'Purge audit retains only the deleted-row count'
);

select * from finish();
rollback;
