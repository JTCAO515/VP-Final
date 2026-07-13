begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
  'ownership-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.users (id, email)
values ('10000000-0000-0000-0000-000000000010', 'ownership-test@example.com');

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trips'::regclass
      and conname = 'trips_exactly_one_owner_check'
  ),
  'trips has the exclusive-owner constraint'
);

select ok(
  not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trips'::regclass
      and conname = 'trips_owner_or_anon_check'
  ),
  'legacy at-least-one-owner constraint is removed'
);

select throws_ok(
  $$insert into public.trips (id, owner, anon_id, snapshot_jsonb)
    values ('10000000-0000-0000-0000-000000000001', null, null, '{}'::jsonb)$$,
  '23514'
);

select lives_ok(
  $$insert into public.trips (id, owner, anon_id, snapshot_jsonb)
    values ('10000000-0000-0000-0000-000000000002', null, 'anon-test', '{}'::jsonb)$$,
  'a trip may have exactly one anonymous owner'
);

select throws_ok(
  $$insert into public.trips (id, owner, anon_id, snapshot_jsonb)
    values (
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000010',
      'anon-test',
      '{}'::jsonb
    )$$,
  '23514'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.trips'::regclass),
  'trips keeps row level security enabled'
);

select * from finish();
rollback;
