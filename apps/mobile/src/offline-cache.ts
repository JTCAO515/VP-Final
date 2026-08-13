import {
  deserializeOfflineMobileCache,
  serializeOfflineMobileCache,
  type OfflineMobileCache,
} from "@visepanda/domain";

export const MOBILE_OFFLINE_CACHE_FILE_NAME = "visepanda-offline-cache-v1.json";

export type OfflineCacheLoadResult =
  { kind: "empty" } | { kind: "ready"; cache: OfflineMobileCache } | { kind: "corrupted_cleared" };

export interface OfflineCacheFile {
  readonly exists: boolean;
  text(): Promise<string>;
  create(options: { intermediates: boolean; overwrite: boolean }): void;
  write(content: string): void;
  delete(): void;
}

export interface OfflineCacheStore {
  load(): Promise<OfflineCacheLoadResult>;
  save(cache: OfflineMobileCache): Promise<void>;
  clear(): Promise<void>;
}

export function createOfflineCacheStore(file: OfflineCacheFile): OfflineCacheStore {
  return {
    async load() {
      if (!file.exists) return { kind: "empty" };

      try {
        return { kind: "ready", cache: deserializeOfflineMobileCache(await file.text()) };
      } catch {
        // A local snapshot is disposable. Clear it rather than surfacing stale or unparsed content.
        if (file.exists) file.delete();
        return { kind: "corrupted_cleared" };
      }
    },
    async save(cache) {
      file.create({ intermediates: true, overwrite: true });
      file.write(serializeOfflineMobileCache(cache));
    },
    async clear() {
      if (file.exists) file.delete();
    },
  };
}
