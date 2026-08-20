create table public.scoped_execution_facts (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  poi_id uuid references public.pois(id) on delete restrict,
  city text,
  scene_key text,
  country_code text,
  fact_type text not null,
  value_jsonb jsonb not null,
  confidence numeric(4,3) not null,
  source text not null,
  source_class text,
  source_locator text,
  evidence_summary text,
  verified_at timestamptz,
  expires_at timestamptz,
  review_policy text,
  reviewed_by uuid references public.ops_memberships(user_id) on delete restrict,
  version integer not null default 1,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scoped_execution_facts_target_check check (
    (scope = 'poi' and poi_id is not null and city is null and scene_key is null and country_code is null)
    or (scope = 'city' and poi_id is null and city is not null and city = lower(btrim(city)) and char_length(city) between 1 and 100 and city !~ '[[:space:]]{2,}' and scene_key is null and country_code is null)
    or (scope = 'scene' and poi_id is null and city is null and scene_key in ('payment', 'show_to_local', 'entry_booking', 'translate_communicate', 'network', 'rescue_human_help') and country_code is null)
    or (scope = 'national' and poi_id is null and city is null and scene_key is null and country_code = 'CN')
  ),
  constraint scoped_execution_facts_fact_type_check
    check (char_length(btrim(fact_type)) between 1 and 120),
  constraint scoped_execution_facts_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint scoped_execution_facts_source_check
    check (char_length(btrim(source)) between 1 and 500),
  constraint scoped_execution_facts_source_class_check
    check (source_class is null or source_class in ('official', 'operator_verified', 'reputable_editorial', 'user_report', 'model_output', 'uncorroborated_scrape')),
  constraint scoped_execution_facts_source_locator_check
    check (source_locator is null or char_length(btrim(source_locator)) between 1 and 500),
  constraint scoped_execution_facts_evidence_summary_check
    check (evidence_summary is null or char_length(btrim(evidence_summary)) between 1 and 240),
  constraint scoped_execution_facts_version_check check (version > 0),
  constraint scoped_execution_facts_status_check
    check (status in ('draft', 'reviewed', 'deprecated', 'rejected')),
  constraint scoped_execution_facts_reviewed_evidence_check check (
    status <> 'reviewed'
    or (
      source_class in ('official', 'operator_verified', 'reputable_editorial')
      and source_locator is not null
      and evidence_summary is not null
      and verified_at is not null
      and expires_at is not null
      and expires_at > verified_at
      and review_policy in ('volatile-30d-v1', 'execution-90d-v1', 'stable-180d-v1')
      and reviewed_by is not null
    )
  ),
  constraint scoped_execution_facts_review_policy_assignment_check check (
    status <> 'reviewed'
    or review_policy = case
      when fact_type in ('booking_required', 'hours', 'payment_acceptance', 'reservation_helpful', 'ticket_availability') then 'volatile-30d-v1'
      when fact_type = 'rainy_fit' then 'stable-180d-v1'
      else 'execution-90d-v1'
    end
  ),
  constraint scoped_execution_facts_review_expiry_check check (
    status <> 'reviewed'
    or (review_policy = 'volatile-30d-v1' and expires_at <= verified_at + interval '30 days')
    or (review_policy = 'execution-90d-v1' and expires_at <= verified_at + interval '90 days')
    or (review_policy = 'stable-180d-v1' and expires_at <= verified_at + interval '180 days')
  )
);

create index scoped_execution_facts_poi_lookup_idx
  on public.scoped_execution_facts (poi_id, fact_type, status, expires_at)
  where scope = 'poi';
create index scoped_execution_facts_city_lookup_idx
  on public.scoped_execution_facts (city, fact_type, status, expires_at)
  where scope = 'city';
create index scoped_execution_facts_scene_lookup_idx
  on public.scoped_execution_facts (scene_key, fact_type, status, expires_at)
  where scope = 'scene';
create index scoped_execution_facts_national_lookup_idx
  on public.scoped_execution_facts (country_code, fact_type, status, expires_at)
  where scope = 'national';

alter table public.scoped_execution_facts enable row level security;
revoke all on table public.scoped_execution_facts from public, anon, authenticated;

comment on table public.scoped_execution_facts is
  'Server-owned reviewed execution facts for one closed POI, city, scene, or China-national target. No direct browser access or public content is authorized.';
comment on column public.scoped_execution_facts.source_locator is
  'Private evidence locator. It is never part of a public fact projection.';
comment on column public.scoped_execution_facts.reviewed_by is
  'Private Ops reviewer identity. It is never part of a public fact projection.';
