import { parseMobileTelemetryQueue, type MobileTelemetryQueue } from "./mobile-telemetry";
import type { OfflineCacheFile } from "./offline-cache";

export const MOBILE_TELEMETRY_QUEUE_FILE_NAME = "visepanda-mobile-telemetry-v1.json";

export type MobileTelemetryQueueLoadResult =
  | { kind: "empty" }
  | { kind: "ready"; queue: MobileTelemetryQueue }
  | { kind: "corrupted_cleared" };

export interface MobileTelemetryQueueStore {
  load(): Promise<MobileTelemetryQueueLoadResult>;
  save(queue: MobileTelemetryQueue): Promise<void>;
}

export function createMobileTelemetryQueueStore(file: OfflineCacheFile): MobileTelemetryQueueStore {
  return {
    async load() {
      if (!file.exists) return { kind: "empty" };
      try {
        return {
          kind: "ready",
          queue: parseMobileTelemetryQueue(JSON.parse(await file.text())),
        };
      } catch {
        if (file.exists) file.delete();
        return { kind: "corrupted_cleared" };
      }
    },
    async save(queue) {
      file.create({ intermediates: true, overwrite: true });
      file.write(JSON.stringify(parseMobileTelemetryQueue(queue)));
    },
  };
}
