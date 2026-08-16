begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_column('public', 'partners', 'kind', 'Partner type distinguishes OTA and creator records');
select has_table('public', 'creator_referrals', 'Creator referral records have a dedicated private relation');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.creator_referrals'::regclass),
  'Creator referrals keep row level security enabled'
);
select is(
  has_table_privilege('anon', 'public.creator_referrals', 'select'),
  false,
  'Anonymous clients cannot read creator referral records'
);
select is(
  has_table_privilege('authenticated', 'public.creator_referrals', 'insert'),
  false,
  'Authenticated clients cannot write creator referral records'
);

insert into public.partners (key, hosts, categories, cities, tracking_param, kind, status)
values
  ('issue99_creator', '["creator.example"]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'vp_click_id', 'creator', 'pending'),
  ('issue99_ota', '["ota.example"]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'vp_click_id', 'ota', 'pending');

select lives_ok(
  $$insert into public.creator_referrals (key, partner_key, landing_path)
    values ('issue99_creator_referral', 'issue99_creator', '/visepanda')$$,
  'A creator referral can reference a creator partner'
);
select throws_ok(
  $$insert into public.creator_referrals (key, partner_key, landing_path)
    values ('issue99_ota_referral', 'issue99_ota', '/visepanda')$$,
  '23514',
  'creator referrals require a creator partner',
  'A creator referral cannot bind an OTA partner'
);
select throws_ok(
  $$insert into public.creator_referrals (key, partner_key, landing_path)
    values ('issue99_unsafe_referral', 'issue99_creator', '//evil.example')$$,
  '23514',
  null,
  'Protocol-relative creator landing paths are rejected'
);
select throws_ok(
  $$update public.partners set kind = 'ota' where key = 'issue99_creator'$$,
  '23514',
  'creator referral partner kind cannot be downgraded',
  'A referred creator partner cannot be reclassified as an OTA record'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'creator_referrals_set_updated_at' and tgrelid = 'public.creator_referrals'::regclass
  ),
  'Creator referrals retain the standard updated-at trigger'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'creator_referrals'
      and column_name in ('email', 'cookie', 'signature', 'authorization', 'target_url')
  ),
  'Creator referrals do not retain contact, credentials, signatures, or an outbound target'
);

select * from finish();
rollback;
