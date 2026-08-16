begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('54000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'image-editor@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.pois (id, city, category, name_en, source_ids)
values ('54000000-0000-4000-8000-000000000002', 'Shanghai', 'attraction', 'Image POI', '{}'::jsonb);

select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'poi_images'),
  'POI image metadata has a dedicated private table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.poi_images'::regclass),
  'POI image metadata enforces row-level security'
);
select is(
  has_table_privilege('anon', 'public.poi_images', 'select'),
  false,
  'anon cannot read POI image metadata'
);
select is(
  has_table_privilege('authenticated', 'public.poi_images', 'select'),
  false,
  'authenticated users cannot read POI image metadata directly'
);
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'ops-poi-images'
      and public = false
      and file_size_limit = 5242880
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  'the editorial bucket is private and restricts accepted source media types'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and coalesce(qual, '') like '%ops-poi-images%'
  ),
  0,
  'the bucket has no direct client storage policy'
);

insert into public.poi_images (
  storage_path, target_kind, poi_id, content_type, byte_size, width, height,
  attribution, license_note, created_by
) values (
  'poi/54000000-0000-4000-8000-000000000002/54000000-0000-4000-8000-000000000003.webp',
  'poi', '54000000-0000-4000-8000-000000000002', 'image/webp', 1024, 640, 480,
  'Licensed photographer collection', 'CC BY 4.0', '54000000-0000-4000-8000-000000000001'
);

select is((select count(*)::integer from public.poi_images), 1, 'a fully attributed POI image is accepted');

select throws_ok(
  $$insert into public.poi_images (storage_path, target_kind, city, category, content_type, byte_size, width, height, attribution, license_note, created_by)
    values ('city/example.webp', 'city', 'Shanghai', 'food', 'image/webp', 1, 1, 1, 'source', 'license', '54000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'a row cannot point at more than one target kind'
);
select throws_ok(
  $$insert into public.poi_images (storage_path, target_kind, city, content_type, byte_size, width, height, attribution, license_note, created_by)
    values ('city/example.jpg', 'city', 'Shanghai', 'image/jpeg', 1, 1, 1, 'source', 'license', '54000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'stored output is normalized to server-generated WebP paths'
);
select throws_ok(
  $$insert into public.poi_images (storage_path, target_kind, city, content_type, byte_size, width, height, attribution, license_note, created_by)
    values ('city/oversized.webp', 'city', 'Shanghai', 'image/webp', 5242881, 1, 1, 'source', 'license', '54000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'oversized stored output is rejected'
);
select throws_ok(
  $$insert into public.poi_images (storage_path, target_kind, city, content_type, byte_size, width, height, attribution, license_note, created_by)
    values ('city/large.webp', 'city', 'Shanghai', 'image/webp', 1, 4097, 1, 'source', 'license', '54000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'oversized dimensions are rejected'
);
select throws_ok(
  $$insert into public.poi_images (storage_path, target_kind, city, content_type, byte_size, width, height, attribution, license_note, created_by)
    values ('city/no-license.webp', 'city', 'Shanghai', 'image/webp', 1, 1, 1, '', '', '54000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'attribution and license note are both mandatory'
);
select throws_ok(
  $$update public.poi_images set deleted_at = now() where storage_path like 'poi/%'$$,
  '23514', null, 'a deletion retains the responsible Ops actor'
);

select * from finish();
rollback;
