create table public.safe_phrases (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  scene text not null,
  intent_key text not null,
  variant_key text not null,
  severity text not null,
  chinese_expression text not null,
  english_intent text not null,
  source_class text not null default 'operator_verified',
  source_locator text not null,
  evidence_summary text not null,
  verified_by uuid references public.ops_memberships(user_id) on delete restrict,
  verified_at timestamptz,
  expires_at timestamptz,
  review_policy text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  constraint safe_phrases_category_check
    check (category in ('allergy_dietary', 'symptoms_medical', 'emergency_help', 'passport_visa_ticket', 'destination_address')),
  constraint safe_phrases_scene_check
    check (scene in ('taxi', 'restaurant', 'venue_entry', 'hotel', 'medical', 'emergency')),
  constraint safe_phrases_key_check
    check (
      intent_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
      and variant_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    ),
  constraint safe_phrases_severity_check
    check (severity in ('standard', 'severe')),
  constraint safe_phrases_expression_check
    check (
      btrim(chinese_expression) <> ''
      and char_length(btrim(chinese_expression)) <= 500
      and btrim(english_intent) <> ''
      and char_length(btrim(english_intent)) <= 500
    ),
  constraint safe_phrases_operator_source_check
    check (source_class = 'operator_verified'),
  constraint safe_phrases_evidence_check
    check (
      btrim(source_locator) <> ''
      and char_length(btrim(source_locator)) <= 500
      and btrim(evidence_summary) <> ''
      and char_length(btrim(evidence_summary)) <= 240
      and evidence_summary !~* '[[:alnum:].+_-]+@[[:alnum:].-]+\\.[[:alpha:]]{2,}'
      and evidence_summary !~ '\\m\\+?[0-9][0-9 ()-]{6,}[0-9]\\M'
    ),
  constraint safe_phrases_status_check
    check (status in ('draft', 'reviewed', 'deprecated', 'rejected')),
  constraint safe_phrases_review_policy_check
    check (review_policy is null or review_policy = 'operator-verified-90d-v1'),
  constraint safe_phrases_reviewed_evidence_check
    check (
      status <> 'reviewed'
      or (
        verified_by is not null
        and verified_at is not null
        and expires_at is not null
        and expires_at > verified_at
        and review_policy = 'operator-verified-90d-v1'
      )
    ),
  constraint safe_phrases_review_expiry_check
    check (
      status <> 'reviewed'
      or expires_at <= verified_at + interval '90 days'
    )
);

create unique index safe_phrases_reviewed_selection_unique
  on public.safe_phrases (category, scene, intent_key, variant_key, severity)
  where status = 'reviewed';

alter table public.safe_phrases enable row level security;
revoke all on table public.safe_phrases from public, anon, authenticated;

comment on table public.safe_phrases is
  'Private, operator-verified fixed expressions for ADR-0016 high-risk categories. Contains no traveler or conversation data.';
comment on column public.safe_phrases.verified_by is
  'Authenticated Ops reviewer identity. This is editorial provenance, not a traveler identity.';
