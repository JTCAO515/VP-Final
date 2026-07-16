begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.poi_fact_editorial_audit'::regclass),
  'bulk import editorial audit keeps row level security enabled'
);

select is(
  has_table_privilege('anon', 'public.poi_fact_editorial_audit', 'select'),
  false,
  'anon cannot read private editorial audit rows'
);

select is(
  has_table_privilege('authenticated', 'public.poi_fact_editorial_audit', 'insert'),
  false,
  'authenticated clients cannot write private editorial audit rows'
);

insert into public.pois (id, city, category, name_en, source_ids)
values (
  '51000000-0000-0000-0000-000000000001',
  'Shanghai',
  'attraction',
  'Bulk Import Audit POI',
  '{"test":"bulk-import"}'::jsonb
);

insert into public.poi_facts (
  id, poi_id, fact_type, value_jsonb, confidence, source, source_class, source_locator,
  evidence_summary, status
)
values (
  '51000000-0000-0000-0000-000000000010',
  '51000000-0000-0000-0000-000000000001',
  'booking_required',
  '{"required":true}'::jsonb,
  0.9,
  'https://example.com/bulk-import',
  'official',
  'https://example.com/bulk-import',
  'Official evidence for the bulk import audit test.',
  'draft'
);

select lives_ok(
  $$insert into public.poi_fact_editorial_audit (
    fact_id, collection_row_id, content_digest, collection_status, researcher, reviewer,
    evidence_reviewed_at, review_notes
  ) values (
    '51000000-0000-0000-0000-000000000010', 'bulk-import-row-1', repeat('a', 64),
    'reviewed', 'researcher_1', 'reviewer_1', now(), 'Independent check completed.'
  )$$,
  'reviewed collection audit retains its private evidence review metadata'
);

select throws_ok(
  $$insert into public.poi_fact_editorial_audit (
    fact_id, collection_row_id, content_digest, collection_status, researcher
  ) values (
    '51000000-0000-0000-0000-000000000010', 'bulk-import-row-2', repeat('b', 64),
    'reviewed', 'researcher_2'
  )$$,
  '23514',
  null,
  'reviewed collection audit cannot omit reviewer and evidence review time'
);

select throws_ok(
  $$insert into public.poi_fact_editorial_audit (
    fact_id, collection_row_id, content_digest, collection_status, researcher, reviewer,
    evidence_reviewed_at
  ) values (
    '51000000-0000-0000-0000-000000000010', 'bulk-import-row-3', repeat('c', 64),
    'reviewed', 'Researcher_3', 'researcher_3', now()
  )$$,
  '23514',
  null,
  'reviewed collection audit requires an independent reviewer'
);

select * from finish();
rollback;
