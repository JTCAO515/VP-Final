create table public.human_task_payments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.human_tasks(id) on delete cascade,
  provider text not null,
  provider_checkout_session_id text not null,
  provider_payment_intent_id text,
  provider_event_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  checkout_url text not null,
  status text not null default 'checkout_open',
  paid_at timestamptz,
  retention_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint human_task_payments_provider_check check (provider = 'stripe'),
  constraint human_task_payments_amount_cents_check check (amount_cents > 0),
  constraint human_task_payments_currency_check check (currency = 'usd'),
  constraint human_task_payments_checkout_url_check check (checkout_url ~ '^https://'),
  constraint human_task_payments_status_check check (status in ('checkout_open', 'paid', 'expired')),
  constraint human_task_payments_paid_evidence_check check (
    (status = 'paid' and provider_payment_intent_id is not null and provider_event_id is not null and paid_at is not null)
    or (status <> 'paid' and provider_payment_intent_id is null and provider_event_id is null and paid_at is null)
  ),
  constraint human_task_payments_retention_check check (retention_expires_at > created_at)
);

create unique index human_task_payments_task_id_unique
  on public.human_task_payments(task_id);
create unique index human_task_payments_provider_checkout_session_unique
  on public.human_task_payments(provider, provider_checkout_session_id);
create unique index human_task_payments_provider_event_unique
  on public.human_task_payments(provider, provider_event_id)
  where provider_event_id is not null;
create index human_task_payments_status_created_idx
  on public.human_task_payments(status, created_at);

alter table public.human_task_payments enable row level security;
revoke all on table public.human_task_payments from public, anon, authenticated;

comment on table public.human_task_payments is
  'Private Stripe Checkout payment ledger. It stores minimal provider references and never card data, a provider secret, signature, or raw webhook payload.';
comment on column public.human_task_payments.provider_event_id is
  'Verified Stripe webhook event id used for idempotent paid-state evidence; raw payload and signature are never stored.';
