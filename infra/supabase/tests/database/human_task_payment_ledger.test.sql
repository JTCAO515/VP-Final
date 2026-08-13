begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'human_task_payments', 'Private Human Task payment ledger exists');
select has_column('public', 'human_task_payments', 'provider_checkout_session_id', 'Checkout session reference exists');
select has_column('public', 'human_task_payments', 'provider_event_id', 'Webhook event id exists');
select has_column('public', 'human_task_payments', 'retention_expires_at', 'Payment retention deadline exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.human_task_payments'::regclass),
  true,
  'Payment ledger has RLS enabled'
);
select is(
  has_table_privilege('anon', 'public.human_task_payments', 'select'),
  false,
  'Anonymous clients cannot read payment ledger records'
);
select is(
  has_table_privilege('authenticated', 'public.human_task_payments', 'select'),
  false,
  'Authenticated clients cannot read payment ledger records directly'
);

insert into public.human_tasks (
  id, anon_id, idempotency_key, city, kind, description, contact, status, price_usd
) values (
  '73000000-0000-4000-8000-000000000001',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '73000000-0000-4000-8000-000000000002', 'Shanghai', 'translation_help',
  'Please translate this request for hotel reception.', 'traveler@example.com', 'quoted', 24.99
);

select lives_ok(
  $$insert into public.human_task_payments (
    task_id, provider, provider_checkout_session_id, amount_cents, currency, checkout_url,
    retention_expires_at
  ) values (
    '73000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_payment_123', 2499, 'usd',
    'https://checkout.stripe.com/c/pay/cs_test_payment_123', now() + interval '365 days'
  )$$,
  'A pending Stripe Checkout record can be stored without card data'
);
select throws_ok(
  $$insert into public.human_task_payments (
    task_id, provider, provider_checkout_session_id, amount_cents, currency, checkout_url,
    retention_expires_at
  ) values (
    '73000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_payment_duplicate', 2499, 'usd',
    'https://checkout.stripe.com/c/pay/cs_test_payment_duplicate', now() + interval '365 days'
  )$$,
  '23505', null, 'A task cannot receive a second payment ledger row'
);
select throws_ok(
  $$insert into public.human_task_payments (
    task_id, provider, provider_checkout_session_id, provider_payment_intent_id, provider_event_id,
    amount_cents, currency, checkout_url, status, paid_at, retention_expires_at
  ) values (
    '73000000-0000-4000-8000-000000000001', 'stripe', 'cs_test_invalid_paid_123',
    null, null, 2499, 'usd', 'https://checkout.stripe.com/c/pay/cs_test_invalid_paid_123', 'paid',
    now(), now() + interval '365 days'
  )$$,
  '23514', null, 'Paid state requires verified provider references'
);
select lives_ok(
  $$update public.human_task_payments
    set status = 'paid', provider_payment_intent_id = 'pi_test_payment_123',
      provider_event_id = 'evt_test_payment_123', paid_at = now()
    where provider_checkout_session_id = 'cs_test_payment_123'$$,
  'Paid state accepts complete verified provider evidence'
);
select throws_ok(
  $$update public.human_task_payments
    set checkout_url = 'http://not-secure.example/payment'
    where provider_checkout_session_id = 'cs_test_payment_123'$$,
  '23514', null, 'Payment ledger rejects non-HTTPS checkout links'
);
select throws_ok(
  $$update public.human_task_payments
    set retention_expires_at = created_at
    where provider_checkout_session_id = 'cs_test_payment_123'$$,
  '23514', null, 'Payment ledger requires a future retention deadline'
);
select is(
  (select count(*)::integer from public.human_task_payments),
  1,
  'Only one minimal payment ledger row remains'
);
select is(
  (select provider_event_id from public.human_task_payments where provider_checkout_session_id = 'cs_test_payment_123'),
  'evt_test_payment_123',
  'Webhook evidence is retained as an opaque provider id only'
);

select * from finish();
rollback;
