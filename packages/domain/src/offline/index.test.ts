import { describe, expect, it } from "vitest";

import {
  createOfflineMobileCache,
  createOfflineTripPackage,
  deserializeOfflineMobileCache,
  deserializeOfflineTripPackage,
  isOfflineTripPackageCurrent,
  OfflineTripPackageSchema,
  serializeOfflineMobileCache,
  serializeOfflineTripPackage,
} from "./index.js";
import { SHOW_TO_LOCAL_PHRASE_PACK } from "../show-to-local/index.js";
import { TOOLS_CONTENT_PACK } from "../tools/index.js";

const savedAt = new Date("2026-08-13T00:00:00.000Z");
const expiresAt = new Date("2026-08-20T00:00:00.000Z");

const trip = {
  id: "trip-offline-fixture",
  title: "Shanghai arrival",
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      city: "Shanghai",
      blocks: [
        {
          id: "block-1",
          type: "transport" as const,
          title: "Metro to hotel",
          address: "People's Square",
          metadata: { serverOnlyHint: "must not persist offline" },
        },
      ],
    },
  ],
};

describe("OfflineTripPackage", () => {
  it("creates a read-only, JSON-serializable snapshot without an opaque metadata bag", () => {
    const tripPackage = createOfflineTripPackage({
      trip,
      toolContentVersion: "tools-2026-08-13",
      phrasePackVersion: "phrases-2026-08-13",
      cities: ["Shanghai"],
      savedAt,
      expiresAt,
    });

    expect(tripPackage.trip.days[0]?.blocks[0]).not.toHaveProperty("metadata");
    expect(deserializeOfflineTripPackage(serializeOfflineTripPackage(tripPackage))).toEqual(
      tripPackage,
    );
    expect(isOfflineTripPackageCurrent(tripPackage, new Date("2026-08-19T23:59:59.000Z"))).toBe(
      true,
    );
  });

  it("rejects credentials and impossible cache lifetimes", () => {
    expect(
      OfflineTripPackageSchema.safeParse({
        version: 1,
        trip: {
          ...trip,
          days: [
            {
              ...trip.days[0],
              blocks: [{ ...trip.days[0]!.blocks[0], notes: "Bearer private-token-value-123456" }],
            },
          ],
        },
        toolContentVersion: "tools-v1",
        phrasePackVersion: "phrases-v1",
        cities: ["Shanghai", "shanghai"],
        savedAt: expiresAt.toISOString(),
        expiresAt: savedAt.toISOString(),
      }).success,
    ).toBe(false);
  });

  it("reports packages unavailable once their explicit expiry is reached", () => {
    const tripPackage = createOfflineTripPackage({
      trip,
      toolContentVersion: "tools-v1",
      phrasePackVersion: "phrases-v1",
      cities: ["Shanghai"],
      savedAt,
      expiresAt,
    });
    expect(isOfflineTripPackageCurrent(tripPackage, expiresAt)).toBe(false);
  });

  it("stores the static Tools and Show to Local packs alongside an optional sanitized Trip", () => {
    const tripPackage = createOfflineTripPackage({
      trip,
      toolContentVersion: TOOLS_CONTENT_PACK.version.toString(),
      phrasePackVersion: SHOW_TO_LOCAL_PHRASE_PACK.version,
      cities: ["Shanghai"],
      savedAt,
      expiresAt,
    });
    const cache = createOfflineMobileCache({
      refreshedAt: savedAt,
      tripPackage,
      toolsContent: TOOLS_CONTENT_PACK,
      phrasePack: SHOW_TO_LOCAL_PHRASE_PACK,
    });

    expect(deserializeOfflineMobileCache(serializeOfflineMobileCache(cache))).toEqual(cache);
    expect(cache.tripPackage?.trip.days[0]?.blocks[0]).not.toHaveProperty("metadata");
    expect(cache.toolsContent.items).toHaveLength(8);
    expect(cache.phrasePack.cards).toHaveLength(6);
  });

  it("keeps a missing Trip explicit while still allowing local preparation content", () => {
    const cache = createOfflineMobileCache({
      refreshedAt: savedAt,
      tripPackage: null,
      toolsContent: TOOLS_CONTENT_PACK,
      phrasePack: SHOW_TO_LOCAL_PHRASE_PACK,
    });

    expect(cache.tripPackage).toBeNull();
  });
});
