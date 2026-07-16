-- Preserve bulk-collection provenance without adding editorial identities or
-- internal review notes to the public poi_facts projection.
create table public.poi_fact_editorial_audit (
  fact_id uuid primary key references public.poi_facts(id) on delete cascade,
  collection_row_id text not null unique,
  content_digest text not null,
  collection_status text not null,
  researcher text not null,
  reviewer text,
  evidence_reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  constraint poi_fact_editorial_audit_collection_status_check
    check (collection_status in ('researched', 'reviewed')),
  constraint poi_fact_editorial_audit_content_digest_check
    check (char_length(content_digest) = 64),
  constraint poi_fact_editorial_audit_reviewed_fields_check
    check (
      (
        collection_status = 'researched'
        and reviewer is null
        and evidence_reviewed_at is null
      )
      or (
        collection_status = 'reviewed'
        and reviewer is not null
        and evidence_reviewed_at is not null
        and lower(reviewer) <> lower(researcher)
      )
    )
);

alter table public.poi_fact_editorial_audit enable row level security;
revoke all on table public.poi_fact_editorial_audit from anon, authenticated;
