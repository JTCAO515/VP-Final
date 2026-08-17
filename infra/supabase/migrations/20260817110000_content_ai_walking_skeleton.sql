-- CONTENT-AI-01b is deliberately a one-operation vertical slice. It is private
-- evidence for the eventual generic Change Set model, not a public content path.
create table public.content_ai_walking_skeleton_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  poi_id uuid not null references public.pois(id) on delete restrict,
  fact_id uuid not null references public.poi_facts(id) on delete restrict,
  fact_type text not null constraint content_ai_walking_skeleton_fact_type_check
    check (fact_type = 'local_address_nearest_metro_exit'),
  before_value_jsonb jsonb,
  after_value_jsonb jsonb not null,
  source_class text not null check (source_class in ('official', 'operator_verified', 'reputable_editorial', 'user_report', 'model_output', 'uncorroborated_scrape')),
  source_locator text not null check (char_length(btrim(source_locator)) between 1 and 500),
  evidence_summary text not null check (char_length(btrim(evidence_summary)) between 1 and 240),
  risk_level text not null check (risk_level = 'execution'),
  expected_fact_version integer not null check (expected_fact_version > 0),
  state text not null default 'draft' constraint content_ai_walking_skeleton_state_check
    check (state in ('draft', 'published', 'conflict')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index content_ai_walking_skeleton_fact_unique
  on public.content_ai_walking_skeleton_drafts(fact_id);
create index content_ai_walking_skeleton_owner_state_idx
  on public.content_ai_walking_skeleton_drafts(owner_id, state, created_at desc);

alter table public.content_ai_walking_skeleton_drafts enable row level security;
revoke all privileges on table public.content_ai_walking_skeleton_drafts from public, anon, authenticated;

comment on table public.content_ai_walking_skeleton_drafts is
  'Private CONTENT-AI-01b single-operation walking-skeleton records. Server-only authorization applies before access; CONTENT-AI-02 supersedes this probe with the generic Change Set schema.';
