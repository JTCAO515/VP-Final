# ADR-0021: Ops POI Image Storage

Date: 2026-08-16
Status: Accepted
Owner: knowledge / security / operations

## Context

POI, city, and category imagery improves the Trip Canvas and Explore surfaces, but a raw image upload
is a privacy, copyright, and content-integrity boundary. A client filename, extension, MIME value, or
EXIF payload is not trustworthy. Public storage would also make an accidental upload immediately
reachable before editorial review.

## Decision

The sole current bucket is the private Supabase Storage bucket `ops-poi-images`. It has a 5 MiB
(`5 * 1024 * 1024`) bucket limit and permits source JPEG, PNG, and WebP only. There are deliberately
no browser `storage.objects` policies for this bucket: the upload/delete path is server-mediated,
requires the existing server-side `knowledge.write` authorization, and requires a server-only
`SUPABASE_SERVICE_ROLE_KEY`. Missing configuration fails closed.

The writer validates a real JPEG/PNG/WebP file signature before decode, rejects source bytes
over 5 MiB or either source dimension over 4096 pixels, and decodes then re-encodes accepted input to
WebP without metadata. The generated object is therefore `image/webp`; EXIF, client-supplied filename,
and client MIME are neither retained in Storage metadata nor persisted in Postgres. Storage paths are
server-generated lowercase WebP paths.

`public.poi_images` is a private, RLS-enabled metadata relation. Every row has exactly one target:
a canonical POI, a city, or a category. Each active row must retain bounded `attribution` and
`license_note`; a non-attributed image cannot be stored. Deletion is a server-owned soft metadata
revocation with the responsible Ops actor, paired with physical-object deletion and an audit event.
The writer deletes the private object before it commits metadata revocation and its audit row. Supabase
Storage and Postgres do not share a transaction: if the database/audit transaction fails after object
deletion, the request fails closed and leaves at most a private missing object, never a public image.
No public URL, traveler upload, scraping, AI generation, face analysis, or live-media display is
authorized by this decision.

## Consequences

The initial release can create and safely curate private editorial assets without treating an object
path as public product content. A later consumer must separately freeze signed delivery, cache scope,
image selection rules, public attribution display, and rollback behavior before an image is shown to a
traveler. Rollback disables the Ops route, deletes approved test objects, and preserves private
metadata/audit evidence; it never converts the bucket to public access. Production configuration is
tracked by OA-022; without its server-only key, the writer stays honestly unavailable.
