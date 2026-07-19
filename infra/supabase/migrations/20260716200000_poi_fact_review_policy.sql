alter table public.poi_facts
  add column review_policy text,
  add column reviewed_by uuid references public.ops_memberships(user_id) on delete restrict;

-- Reviewer identity cannot be reconstructed for legacy rows. Keep the evidence, but require review again.
update public.poi_facts
set status = 'draft',
    verified_at = null,
    review_policy = null,
    reviewed_by = null
where status = 'reviewed';

alter table public.poi_facts
  drop constraint poi_facts_reviewed_evidence_check;

alter table public.poi_facts
  add constraint poi_facts_review_policy_check
    check (
      review_policy is null
      or review_policy in ('volatile-30d-v1', 'execution-90d-v1', 'stable-180d-v1')
    ),
  add constraint poi_facts_reviewed_evidence_check
    check (
      status <> 'reviewed'
      or (
        source_class in ('official', 'operator_verified', 'reputable_editorial')
        and source_locator is not null
        and btrim(source_locator) <> ''
        and evidence_summary is not null
        and btrim(evidence_summary) <> ''
        and char_length(evidence_summary) <= 240
        and verified_at is not null
        and expires_at is not null
        and expires_at > verified_at
        and review_policy is not null
        and reviewed_by is not null
      )
    ),
  add constraint poi_facts_review_policy_assignment_check
    check (
      status <> 'reviewed'
      or review_policy = case
        when fact_type in (
          'booking_required',
          'hours',
          'payment_acceptance',
          'reservation_helpful',
          'ticket_availability'
        ) then 'volatile-30d-v1'
        when fact_type = 'rainy_fit' then 'stable-180d-v1'
        else 'execution-90d-v1'
      end
    ),
  add constraint poi_facts_review_expiry_check
    check (
      status <> 'reviewed'
      or (review_policy = 'volatile-30d-v1' and expires_at <= verified_at + interval '30 days')
      or (review_policy = 'execution-90d-v1' and expires_at <= verified_at + interval '90 days')
      or (review_policy = 'stable-180d-v1' and expires_at <= verified_at + interval '180 days')
    );

drop policy if exists poi_facts_public_read_reviewed on public.poi_facts;
create policy poi_facts_public_read_reviewed
  on public.poi_facts
  for select
  to anon, authenticated
  using (
    status = 'reviewed'
    and source_class in ('official', 'operator_verified', 'reputable_editorial')
    and source_locator is not null
    and evidence_summary is not null
    and verified_at is not null
    and verified_at <= now()
    and expires_at is not null
    and expires_at >= now()
    and review_policy is not null
    and reviewed_by is not null
  );

comment on column public.poi_facts.review_policy is
  'Versioned deterministic cadence used for the latest independent review; safe for public freshness metadata.';
comment on column public.poi_facts.reviewed_by is
  'Private authenticated Ops reviewer. Never exposed through the public POI fact contract.';
