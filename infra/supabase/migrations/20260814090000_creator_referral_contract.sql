-- Creator referrals are acquisition sources. They do not create a public link until Ops configures
-- an active creator Partner and a later consumer resolves that record server-side.
alter table public.partners
  add column kind text not null default 'ota',
  add constraint partners_kind_check check (kind in ('ota', 'creator'));

create table public.creator_referrals (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  partner_key text not null unique references public.partners(key) on delete restrict,
  landing_path text not null check (landing_path ~ '^/(?!/)[A-Za-z0-9._~!$&''()*+,;=:@%/-]*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.enforce_creator_referral_partner_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.partners
    where key = new.partner_key and kind = 'creator'
  ) then
    raise exception 'creator referrals require a creator partner' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger creator_referrals_require_creator_partner
before insert or update of partner_key on public.creator_referrals
for each row execute function public.enforce_creator_referral_partner_kind();

create function public.prevent_creator_referral_partner_kind_downgrade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> 'creator' and exists (
    select 1 from public.creator_referrals where partner_key = new.key
  ) then
    raise exception 'creator referral partner kind cannot be downgraded' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger partners_prevent_creator_referral_kind_downgrade
before update of kind on public.partners
for each row execute function public.prevent_creator_referral_partner_kind_downgrade();

create trigger creator_referrals_set_updated_at
before update on public.creator_referrals
for each row execute function public.set_updated_at();

alter table public.creator_referrals enable row level security;
revoke all on table public.creator_referrals from public, anon, authenticated;
