import { createClient } from "@supabase/supabase-js";

export const OPS_POI_IMAGE_BUCKET = "ops-poi-images";

export type PoiImageStorageGateway = {
  upload(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
};

export class PoiImageStorageUnavailableError extends Error {}

export function createPoiImageStorageGateway(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PoiImageStorageGateway {
  const url = environment.SUPABASE_URL;
  const serviceRole = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new PoiImageStorageUnavailableError("Ops image storage is not configured.");
  }
  const client = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return {
    async upload(path, bytes) {
      const { error } = await client.storage.from(OPS_POI_IMAGE_BUCKET).upload(path, bytes, {
        contentType: "image/webp",
        upsert: false,
      });
      if (error) throw new PoiImageStorageUnavailableError("Ops image storage is unavailable.");
    },
    async remove(path) {
      const { error } = await client.storage.from(OPS_POI_IMAGE_BUCKET).remove([path]);
      if (error) throw new PoiImageStorageUnavailableError("Ops image storage is unavailable.");
    },
  };
}
