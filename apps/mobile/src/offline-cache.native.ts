import { File, Paths } from "expo-file-system";

import {
  createOfflineCacheStore,
  MOBILE_OFFLINE_CACHE_FILE_NAME,
  type OfflineCacheStore,
} from "./offline-cache";

export function createNativeOfflineCacheStore(): OfflineCacheStore {
  return createOfflineCacheStore(new File(Paths.document, MOBILE_OFFLINE_CACHE_FILE_NAME));
}
