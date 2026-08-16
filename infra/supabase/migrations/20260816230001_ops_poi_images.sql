-- ADR-0021 freezes editorial imagery as a private, server-mediated storage surface.
-- No browser role receives a storage.objects policy for this bucket: raw files must first pass the
-- Ops route's signature validation and metadata-stripping re-encode before service-side upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ops-poi-images',
  'ops-poi-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.poi_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  target_kind text not null,
  poi_id uuid references public.pois(id) on delete restrict,
  city text,
  category text,
  content_type text not null default 'image/webp',
  byte_size integer not null,
  width integer not null,
  height integer not null,
  attribution text not null,
  license_note text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint poi_images_target_kind_check
    check (target_kind in ('poi', 'city', 'category')),
  constraint poi_images_exactly_one_target_check
    check (
      (target_kind = 'poi' and poi_id is not null and city is null and category is null)
      or (target_kind = 'city' and poi_id is null and city is not null and btrim(city) <> '' and category is null)
      or (target_kind = 'category' and poi_id is null and city is null and category in ('food', 'attraction', 'hotel', 'shopping', 'experience'))
    ),
  constraint poi_images_storage_path_check
    check (storage_path ~ '^[a-z0-9][a-z0-9/_-]*\.webp$' and char_length(storage_path) <= 300),
  constraint poi_images_content_type_check
    check (content_type = 'image/webp'),
  constraint poi_images_byte_size_check
    check (byte_size between 1 and 5242880),
  constraint poi_images_dimensions_check
    check (width between 1 and 4096 and height between 1 and 4096),
  constraint poi_images_attribution_check
    check (btrim(attribution) <> '' and char_length(attribution) <= 500),
  constraint poi_images_license_note_check
    check (btrim(license_note) <> '' and char_length(license_note) <= 500),
  constraint poi_images_deletion_evidence_check
    check ((deleted_at is null and deleted_by is null) or (deleted_at is not null and deleted_by is not null))
);

create index poi_images_active_poi_idx
  on public.poi_images (poi_id, created_at)
  where deleted_at is null;

alter table public.poi_images enable row level security;
revoke all on table public.poi_images from anon, authenticated;

comment on table public.poi_images is
  'Private Ops editorial image metadata. Public display and direct browser storage access are intentionally absent.';
comment on column public.poi_images.storage_path is
  'Server-generated private bucket path only; never a user filename or public URL.';
comment on column public.poi_images.attribution is
  'Required bounded source or copyright attribution supplied by the authorized Ops reviewer.';
comment on column public.poi_images.license_note is
  'Required bounded statement of the permitted editorial use.';
