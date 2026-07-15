-- Preserve evidence provenance separately from the legacy display-oriented
-- `source` field. Existing rows remain stored, but none are promoted or have
-- evidence inferred from the old string.
alter table public.poi_facts
  add column source_class text,
  add column source_locator text,
  add column evidence_summary text,
  alter column verified_at drop not null;

alter table public.poi_facts
  add constraint poi_facts_source_class_check
  check (
    source_class is null
    or source_class in (
      'official',
      'operator_verified',
      'reputable_editorial',
      'user_report',
      'model_output',
      'uncorroborated_scrape'
    )
  ),
  add constraint poi_facts_source_locator_check
  check (source_locator is null or btrim(source_locator) <> ''),
  add constraint poi_facts_evidence_summary_check
  check (
    evidence_summary is null
    or (btrim(evidence_summary) <> '' and char_length(evidence_summary) <= 240)
  );

-- A legacy reviewed row has no typed evidence metadata. Conservatively return
-- it to draft instead of inventing provenance or preserving public eligibility.
update public.poi_facts
set status = 'draft', verified_at = null
where status = 'reviewed'
  and (
    source_class is null
    or source_locator is null
    or evidence_summary is null
  );

alter table public.poi_facts
  add constraint poi_facts_reviewed_evidence_check
  check (
    status <> 'reviewed'
    or (
      source_class is not null
      and source_class in ('official', 'operator_verified', 'reputable_editorial')
      and source_locator is not null
      and btrim(source_locator) <> ''
      and evidence_summary is not null
      and btrim(evidence_summary) <> ''
      and char_length(evidence_summary) <= 240
      and verified_at is not null
    )
  );

drop policy if exists "poi_facts_public_read_reviewed" on public.poi_facts;

create policy "poi_facts_public_read_reviewed"
on public.poi_facts
for select
to anon, authenticated
using (
  status = 'reviewed'
  and source_class in ('official', 'operator_verified', 'reputable_editorial')
  and btrim(source_locator) <> ''
  and btrim(evidence_summary) <> ''
  and verified_at is not null
  and verified_at <= now()
  and (expires_at is null or expires_at >= now())
);
