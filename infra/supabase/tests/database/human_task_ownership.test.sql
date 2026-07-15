begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_column('public', 'human_tasks', 'anon_id', 'Human Tasks support signed-anonymous ownership');
select has_column('public', 'human_tasks', 'idempotency_key', 'Human Tasks require an idempotency key');
select has_column('public', 'human_tasks', 'retention_expires_at', 'Human Tasks expose a retention deadline');

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conrelid = 'public.human_tasks'::regclass
      and conname = 'human_tasks_user_id_fkey'
  ),
  'c',
  'Deleting an authenticated owner cascades their Human Tasks'
);

select throws_ok(
  $$insert into public.human_tasks (
      idempotency_key, city, kind, description, contact
    ) values (
      '70000000-0000-4000-8000-000000000001', 'Shanghai', 'other',
      'Ownerless task must not be stored.', 'owner@example.com'
    )$$,
  '23514',
  null,
  'Ownerless Human Tasks are rejected'
);

select throws_ok(
  $$insert into public.human_tasks (
      anon_id, idempotency_key, city, kind, description, contact
    ) values (
      'short', '70000000-0000-4000-8000-000000000002', 'Shanghai', 'other',
      'Malformed anonymous owner must not be stored.', 'owner@example.com'
    )$$,
  '23514',
  null,
  'Malformed anonymous owners are rejected'
);

select lives_ok(
  $$insert into public.human_tasks (
      anon_id, idempotency_key, city, kind, description, contact
    ) values (
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '70000000-0000-4000-8000-000000000003', 'Shanghai', 'translation_help',
      'Please relay this short message to the hotel.', 'owner@example.com'
    )$$,
  'A valid signed-anonymous Human Task can be stored'
);

select throws_ok(
  $$insert into public.human_tasks (
      anon_id, idempotency_key, city, kind, description, contact
    ) values (
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '70000000-0000-4000-8000-000000000003', 'Shanghai', 'translation_help',
      'A replay must not create a second task.', 'other@example.com'
    )$$,
  '23505',
  null,
  'The idempotency key cannot create a second Human Task'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '70000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
  'verified@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.users (id, email)
values ('70000000-0000-4000-8000-000000000004', 'verified@example.com');

select throws_ok(
  $$insert into public.human_tasks (
      user_id, anon_id, idempotency_key, city, kind, description, contact
    ) values (
      '70000000-0000-4000-8000-000000000004',
      'ccccccccccccccccccccccccccccccccccccccccccc',
      '70000000-0000-4000-8000-000000000005', 'Shanghai', 'ticket_help',
      'Dual ownership must not be stored.', 'verified@example.com'
    )$$,
  '23514',
  null,
  'A Human Task cannot have both authenticated and anonymous owners'
);

select throws_ok(
  $$insert into public.human_tasks (
      user_id, idempotency_key, city, kind, description, contact, retention_expires_at
    ) values (
      '70000000-0000-4000-8000-000000000004',
      '70000000-0000-4000-8000-000000000006', 'Shanghai', 'ticket_help',
      'Requested work cannot already have a deletion deadline.', 'verified@example.com', now()
    )$$,
  '23514',
  null,
  'Only terminal Human Tasks can receive a retention deadline'
);

select lives_ok(
  $$insert into public.human_tasks (
      user_id, idempotency_key, city, kind, description, contact, status, retention_expires_at
    ) values (
      '70000000-0000-4000-8000-000000000004',
      '70000000-0000-4000-8000-000000000007', 'Shanghai', 'ticket_help',
      'Expired terminal work is ready for retention cleanup.', 'verified@example.com',
      'cancelled', now() - interval '1 minute'
    )$$,
  'A terminal Human Task can receive a retention deadline'
);

select is(
  internal.purge_expired_human_tasks(),
  1::bigint,
  'Retention cleanup deletes only the expired terminal Human Task'
);

select is(
  has_table_privilege('anon', 'public.human_tasks', 'select'),
  false,
  'Anonymous Data API clients cannot read Human Tasks'
);

select is(
  has_table_privilege('authenticated', 'public.human_tasks', 'select'),
  false,
  'Authenticated Data API clients cannot read Human Tasks directly'
);

select * from finish();
rollback;
