import { describe, expect, it } from "vitest";

import { createMobileTelemetryQueue } from "./mobile-telemetry.js";
import { createMobileTelemetryQueueStore } from "./mobile-telemetry-store.js";
import type { OfflineCacheFile } from "./offline-cache.js";

class InMemoryFile implements OfflineCacheFile {
  private value: string | null = null;
  get exists() {
    return this.value !== null;
  }
  async text() {
    if (this.value === null) throw new Error("missing");
    return this.value;
  }
  create() {
    this.value = "";
  }
  write(content: string) {
    this.value = content;
  }
  delete() {
    this.value = null;
  }
  corrupt() {
    this.value = "not-json";
  }
}

describe("mobile telemetry queue store", () => {
  it("clears a malformed local queue rather than replaying unvalidated content", async () => {
    const file = new InMemoryFile();
    const store = createMobileTelemetryQueueStore(file);
    await store.save(createMobileTelemetryQueue());
    expect(await store.load()).toEqual({ kind: "ready", queue: createMobileTelemetryQueue() });
    file.corrupt();
    expect(await store.load()).toEqual({ kind: "corrupted_cleared" });
    expect(file.exists).toBe(false);
  });
});
