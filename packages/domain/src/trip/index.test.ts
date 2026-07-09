import { describe, expect, it } from "vitest";
import { applyPatch, diffTrips, TripStateSchema } from "./index.js";
import type { TripPatch, TripState } from "./index.js";

const shanghaiTrip: TripState = {
  id: "trip-shanghai",
  title: "Shanghai sample",
  destinationCountry: "CN",
  startDate: "2026-03-12",
  endDate: "2026-03-16",
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      city: "Shanghai",
      title: "Arrival",
      blocks: [
        {
          id: "block-1",
          type: "attraction",
          title: "Yu Garden",
          startTime: "09:00",
          address: "279 Yuyuan Old St",
        },
      ],
    },
  ],
};

describe("TripState schema", () => {
  it("parses valid trips and defaults China as the destination country", () => {
    const parsed = TripStateSchema.parse(shanghaiTrip);
    expect(parsed.destinationCountry).toBe("CN");
    expect(parsed.days[0]?.blocks[0]?.title).toBe("Yu Garden");
  });

  it("rejects duplicate day numbers", () => {
    const patch: TripPatch = {
      operations: [
        { op: "create_trip", trip: shanghaiTrip },
        {
          op: "upsert_day",
          day: { id: "day-2", dayNumber: 1, city: "Shanghai", blocks: [] },
        },
      ],
    };

    expect(() => applyPatch(null, patch)).toThrow("Duplicate TripDay dayNumber");
  });
});

describe("applyPatch", () => {
  it("creates a trip from an empty state", () => {
    const trip = applyPatch(null, {
      operations: [{ op: "create_trip", trip: shanghaiTrip }],
    });

    expect(trip.id).toBe("trip-shanghai");
    expect(trip.days).toHaveLength(1);
  });

  it("replaces an existing trip", () => {
    const replacement = {
      ...shanghaiTrip,
      id: "trip-beijing",
      title: "Beijing sample",
      days: [],
    };

    const trip = applyPatch(shanghaiTrip, {
      operations: [{ op: "replace_trip", trip: replacement }],
    });

    expect(trip.id).toBe("trip-beijing");
    expect(trip.days).toHaveLength(0);
  });

  it("applies field-level trip, day, and block updates", () => {
    const trip = applyPatch(shanghaiTrip, {
      operations: [
        { op: "update_trip", fields: { travelers: 2 } },
        {
          op: "update_day",
          dayNumber: 1,
          fields: { summary: "Old town morning" },
        },
        {
          op: "update_block",
          dayId: "day-1",
          blockId: "block-1",
          fields: { status: "ready" },
        },
      ],
    });

    expect(trip.travelers).toBe(2);
    expect(trip.days[0]?.summary).toBe("Old town morning");
    expect(trip.days[0]?.blocks[0]?.status).toBe("ready");
  });

  it("upserts and deletes days", () => {
    const withSecondDay = applyPatch(shanghaiTrip, {
      operations: [
        {
          op: "upsert_day",
          day: { id: "day-2", dayNumber: 2, city: "Shanghai", blocks: [] },
        },
      ],
    });

    expect(withSecondDay.days.map((day) => day.id)).toEqual(["day-1", "day-2"]);

    const deleted = applyPatch(withSecondDay, {
      operations: [{ op: "delete_day", dayId: "day-1" }],
    });

    expect(deleted.days.map((day) => day.id)).toEqual(["day-2"]);
  });

  it("upserts and deletes blocks within a day", () => {
    const withBlock = applyPatch(shanghaiTrip, {
      operations: [
        {
          op: "upsert_block",
          dayNumber: 1,
          block: {
            id: "block-2",
            type: "restaurant",
            title: "Lunch",
          },
        },
      ],
    });

    expect(withBlock.days[0]?.blocks.map((block) => block.id)).toEqual(["block-1", "block-2"]);

    const deleted = applyPatch(withBlock, {
      operations: [{ op: "delete_block", dayNumber: 1, blockId: "block-1" }],
    });

    expect(deleted.days[0]?.blocks.map((block) => block.id)).toEqual(["block-2"]);
  });
});

describe("diffTrips", () => {
  it("returns an empty patch for equal trips", () => {
    expect(diffTrips(shanghaiTrip, shanghaiTrip)).toEqual({ operations: [] });
  });

  it("returns a create patch when no previous trip exists", () => {
    expect(diffTrips(null, shanghaiTrip)).toEqual({
      operations: [{ op: "create_trip", trip: TripStateSchema.parse(shanghaiTrip) }],
    });
  });

  it("returns deterministic operations that recreate the next trip", () => {
    const next = applyPatch(shanghaiTrip, {
      operations: [
        { op: "update_trip", fields: { title: "Shanghai refined" } },
        {
          op: "upsert_day",
          day: { id: "day-2", dayNumber: 2, city: "Shanghai", blocks: [] },
        },
      ],
    });

    expect(applyPatch(shanghaiTrip, diffTrips(shanghaiTrip, next))).toEqual(next);
  });
});
