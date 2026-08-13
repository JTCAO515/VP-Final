import { describe, expect, it } from "vitest";

import {
  createOfflineTripPackage,
  deserializeOfflineTripPackage,
  isOfflineTripPackageCurrent,
  OfflineTripPackageSchema,
  serializeOfflineTripPackage,
} from "./index.js";

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
});
