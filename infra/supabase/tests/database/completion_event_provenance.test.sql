begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into public.trips (id, anon_id, head_version, snapshot_jsonb)
values (
  '60000000-0000-0000-0000-000000000001',
  'completion-provenance-test',
  1,
  '{"id":"60000000-0000-0000-0000-000000000001","title":"Test","destinationCountry":"CN","days":[]}'::jsonb
);

insert into public.copilot_completion_jobs (
  id, trip_id, base_version, idempotency_key
) values (
  '60000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000001',
  1,
  '60000000-0000-0000-0000-000000000003'
);

select has_column(
  'public',
  'trip_events',
  'completion_job_id',
  'Trip events expose server-only completion job provenance'
);

select has_column(
  'public',
  'trip_events',
  'completion_attempt',
  'Trip events expose server-only completion attempt provenance'
);

select lives_ok(
  $$insert into public.trip_events (trip_id, version, patch_jsonb, source)
    values ('60000000-0000-0000-0000-000000000001', 1, '{"operations":[]}'::jsonb, 'user_manual')$$,
  'Normal Trip events remain backward compatible without completion provenance'
);

select throws_ok(
  $$insert into public.trip_events (
      trip_id, version, patch_jsonb, source, completion_job_id
    ) values (
      '60000000-0000-0000-0000-000000000001', 2, '{"operations":[]}'::jsonb,
      'ai_copilot', '60000000-0000-0000-0000-000000000002'
    )$$,
  '23514',
  null,
  'Completion job and attempt provenance must be supplied together'
);

select throws_ok(
  $$insert into public.trip_events (
      trip_id, version, patch_jsonb, source, completion_job_id, completion_attempt
    ) values (
      '60000000-0000-0000-0000-000000000001', 2, '{"operations":[]}'::jsonb,
      'user_manual', '60000000-0000-0000-0000-000000000002', 1
    )$$,
  '23514',
  null,
  'Completion provenance is restricted to AI Copilot events'
);

select lives_ok(
  $$insert into public.trip_events (
      trip_id, version, patch_jsonb, source, completion_job_id, completion_attempt
    ) values (
      '60000000-0000-0000-0000-000000000001', 2, '{"operations":[]}'::jsonb,
      'ai_copilot', '60000000-0000-0000-0000-000000000002', 1
    )$$,
  'A completion attempt can append one linked Trip event'
);

select throws_ok(
  $$insert into public.trip_events (
      trip_id, version, patch_jsonb, source, completion_job_id, completion_attempt
    ) values (
      '60000000-0000-0000-0000-000000000001', 3, '{"operations":[]}'::jsonb,
      'ai_copilot', '60000000-0000-0000-0000-000000000002', 1
    )$$,
  '23505',
  null,
  'A replayed completion attempt cannot append a second Trip event'
);

select throws_ok(
  $$delete from public.copilot_completion_jobs
    where id = '60000000-0000-0000-0000-000000000002'$$,
  '23503',
  null,
  'A referenced completion job cannot be deleted with its append-only Trip event'
);

select is(
  (
    select count(*)::integer
    from public.trip_events
    where completion_job_id = '60000000-0000-0000-0000-000000000002'
  ),
  1,
  'Rejecting completion job deletion preserves the linked Trip event'
);

select * from finish();
rollback;
