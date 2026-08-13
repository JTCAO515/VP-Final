import {
  createOfflineMobileCache,
  SHOW_TO_LOCAL_PHRASE_PACK,
  TOOLS_CONTENT_PACK,
} from "@visepanda/domain";
import { describe, expect, it } from "vitest";

import { createOfflineCacheStore, type OfflineCacheFile } from "./offline-cache.js";

class InMemoryOfflineCacheFile implements OfflineCacheFile {
  private value: string | null = null;

  get exists() {
    return this.value !== null;
  }

  async text() {
    if (this.value === null) throw new Error("file missing");
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

  corrupt(content: string) {
    this.value = content;
  }
}

const cache = createOfflineMobileCache({
  refreshedAt: new Date("2026-08-14T00:00:00.000Z"),
  tripPackage: null,
  toolsContent: TOOLS_CONTENT_PACK,
  phrasePack: SHOW_TO_LOCAL_PHRASE_PACK,
});

describe("mobile offline cache", () => {
  it("persists a versioned local snapshot and can clear it manually", async () => {
    const file = new InMemoryOfflineCacheFile();
    const store = createOfflineCacheStore(file);

    expect(await store.load()).toEqual({ kind: "empty" });
    await store.save(cache);
    expect(await store.load()).toEqual({ kind: "ready", cache });
    await store.clear();
    expect(await store.load()).toEqual({ kind: "empty" });
  });

  it("removes corrupted content instead of exposing an unvalidated cache", async () => {
    const file = new InMemoryOfflineCacheFile();
    file.corrupt('{"not":"a cache"}');
    const store = createOfflineCacheStore(file);

    expect(await store.load()).toEqual({ kind: "corrupted_cleared" });
    expect(file.exists).toBe(false);
  });
});
