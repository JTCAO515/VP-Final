import { describe, expect, it } from "vitest";
import { createArrivalPack } from "./index.js";

const generatedAt = new Date("2026-08-13T00:00:00.000Z");
const expiresAt = new Date("2026-08-20T00:00:00.000Z");

const trip = {
  id: "arrival-pack-trip",
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
          title: "Metro to the hotel",
          startTime: "09:30",
          address: "Unverified address must not export",
          description: "Private itinerary detail must not export",
          notes: "Personal note must not export",
          metadata: { serverOnlyHint: "must not export" },
        },
      ],
    },
  ],
};

describe("ArrivalPack", () => {
  it("projects only a first-day execution summary and never copies opaque or free-form block data", () => {
    const pack = createArrivalPack({ trip, tripVersion: 4, generatedAt, expiresAt });

    expect(pack.firstDay.blocks).toEqual([
      { title: "Metro to the hotel", startTime: "09:30", endTime: null, status: null },
    ]);
    expect(JSON.stringify(pack)).not.toContain("Unverified address");
    expect(JSON.stringify(pack)).not.toContain("Private itinerary detail");
    expect(JSON.stringify(pack)).not.toContain("Personal note");
    expect(JSON.stringify(pack)).not.toContain("serverOnlyHint");
    expect(pack.verifiedAddresses).toEqual([]);
    expect(pack.readiness).toBeNull();
  });

  it("rejects an expired or impossible reviewed-address receipt", () => {
    expect(() =>
      createArrivalPack({
        trip,
        tripVersion: 0,
        generatedAt,
        expiresAt,
        verifiedAddresses: [
          {
            label: "Hotel",
            localAddressZh: "上海市黄浦区示例路 1 号",
            sourceFactId: "550e8400-e29b-41d4-a716-446655440000",
            verifiedAt: "2026-08-14T00:00:00.000Z",
            expiresAt: "2026-08-19T00:00:00.000Z",
          },
        ],
      }),
    ).toThrow("cannot be verified after generation");
  });

  it("represents a sparse Trip without inventing a first day or Chinese address", () => {
    const pack = createArrivalPack({
      trip: { id: "empty-arrival-pack", title: "China trip", days: [] },
      tripVersion: 0,
      generatedAt,
      expiresAt,
    });

    expect(pack.firstDay).toEqual({
      dayNumber: null,
      date: null,
      city: null,
      title: null,
      blocks: [],
    });
    expect(pack.verifiedAddresses).toEqual([]);
  });
});
