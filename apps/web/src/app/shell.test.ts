import { describe, expect, it } from "vitest";
import { previewTripDays } from "./shell";

describe("previewTripDays", () => {
  it("preserves only the first three server-returned days for the read-only demo preview", () => {
    const days = previewTripDays({
      id: "a0a00000-0000-4000-8000-000000000001",
      title: "Shanghai practical trip",
      destinationCountry: "CN",
      days: [
        { id: "day-1", dayNumber: 1, blocks: [] },
        { id: "day-2", dayNumber: 2, blocks: [] },
        { id: "day-3", dayNumber: 3, blocks: [] },
        { id: "day-4", dayNumber: 4, blocks: [] },
      ],
    });

    expect(days.map((day) => day.id)).toEqual(["day-1", "day-2", "day-3"]);
  });
});
