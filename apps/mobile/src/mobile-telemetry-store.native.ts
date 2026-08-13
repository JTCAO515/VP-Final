import { File, Paths } from "expo-file-system";

import {
  createMobileTelemetryQueueStore,
  MOBILE_TELEMETRY_QUEUE_FILE_NAME,
} from "./mobile-telemetry-store";

export function createNativeMobileTelemetryQueueStore() {
  return createMobileTelemetryQueueStore(
    new File(Paths.document, MOBILE_TELEMETRY_QUEUE_FILE_NAME),
  );
}
