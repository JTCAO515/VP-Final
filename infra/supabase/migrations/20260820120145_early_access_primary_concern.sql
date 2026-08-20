alter table public.early_access_signups
  add column primary_concern text;

alter table public.early_access_signups
  add constraint early_access_signups_primary_concern_check
    check (
      primary_concern is null
      or primary_concern in (
        'payment_and_cash',
        'transport_and_navigation',
        'internet_and_essential_apps',
        'language_and_communication',
        'entry_tickets_and_booking',
        'finding_places_and_addresses',
        'food_and_dietary_needs',
        'accommodation_and_check_in',
        'changing_plans_or_getting_help',
        'something_else'
      )
    );

comment on column public.early_access_signups.primary_concern is
  'Optional fixed Early Access concern category for aggregate content-priority planning. Never free text, a profile, or an automatic knowledge fact.';
