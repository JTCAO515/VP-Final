import { describe, expect, it } from "vitest";
import { attachTripToLatestAssistant, previewTripDays } from "./shell";

const completedTrip = {
  id: "a0a00000-0000-4000-8000-000000000001",
  title: "Completed Shanghai trip",
  destinationCountry: "CN" as const,
  days: [{ id: "day-1", dayNumber: 1, blocks: [] }],
};

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

  it("updates the latest assistant Trip in place without creating a second chat bubble", () => {
    const envelope = {
      intent: "trip_create" as const,
      message: {
        headline: "Shanghai skeleton",
        body: "The details will arrive silently.",
        highlights: [],
      },
      tripActions: [],
      citations: [],
      toolCards: [],
      commercialActions: [],
      humanHelp: null,
      risk: { level: "low" as const, reason: null },
    };
    const messages = [
      { role: "user" as const, body: "Plan Shanghai" },
      {
        role: "assistant" as const,
        body: envelope.message.body,
        envelope,
        trip: null,
      },
    ];

    const updated = attachTripToLatestAssistant(messages, completedTrip);

    expect(updated).toHaveLength(messages.length);
    expect(updated[0]).toBe(messages[0]);
    expect(updated[1]).toMatchObject({ body: envelope.message.body, trip: completedTrip });
  });
});
