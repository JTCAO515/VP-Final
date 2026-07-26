begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_column('public', 'outbound_clicks', 'user_id', 'Outbound clicks can retain verified-user context');
select has_column('public', 'outbound_clicks', 'anon_id', 'Outbound clicks can retain signed-anonymous context');

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'outbound_clicks_identity_exclusive_check'
      and conrelid = 'public.outbound_clicks'::regclass
  ),
  'Outbound click identity exclusivity is explicitly constrained'
);

select has_index('public', 'outbound_clicks', 'outbound_clicks_user_created_idx', 'Verified-user click lookup is indexed');
select has_index('public', 'outbound_clicks', 'outbound_clicks_anon_created_idx', 'Anonymous click lookup is indexed');

select lives_ok(
  $$insert into public.outbound_clicks (
      partner, target_url, anon_id, source, intent
    ) values (
      'tripcom', 'https://www.trip.com/hotels',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'copilot', 'commerce_intent'
    )$$,
  'A server-derived signed-anonymous click can be retained'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'outbound-contract@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.users (id, email)
values ('71000000-0000-4000-8000-000000000001', 'outbound-contract@example.com');

select throws_ok(
  $$insert into public.outbound_clicks (
      partner, target_url, user_id, anon_id, source, intent
    ) values (
      'tripcom', 'https://www.trip.com/hotels',
      '71000000-0000-4000-8000-000000000001',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'copilot', 'commerce_intent'
    )$$,
  '23514',
  null,
  'A click cannot carry both authenticated and anonymous identities'
);

select is(
  has_table_privilege('anon', 'public.outbound_clicks', 'select'),
  false,
  'Anonymous Data API clients cannot read the click ledger'
);
select is(
  has_table_privilege('authenticated', 'public.outbound_clicks', 'select'),
  false,
  'Authenticated Data API clients cannot read the click ledger directly'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'outbound_clicks'
      and column_name in ('api_key', 'cookie', 'signature', 'authorization', 'email', 'contact')
  ),
  'Outbound identity extension stores no credentials, signatures, or contact fields'
);

select * from finish();
rollback;
