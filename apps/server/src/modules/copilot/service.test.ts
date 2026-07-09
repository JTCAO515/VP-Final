import { describe, expect, it } from "vitest";
import { createInMemoryTripService } from "../trip/service.js";
import { createCopilotPipeline, defaultRouteIntent } from "./service.js";

describe("defaultRouteIntent", () => {
  it("routes common planning and commerce messages", () => {
    expect(defaultRouteIntent({ message: "Plan a 3 day Shanghai trip", currentTrip: null })).toBe(
      "trip_create",
    );
    expect(defaultRouteIntent({ message: "Can I book this hotel?", currentTrip: null })).toBe(
      "commerce_intent",
    );
    expect(defaultRouteIntent({ message: "How do I use Alipay?", currentTrip: null })).toBe(
      "question",
    );
  });
});

describe("createCopilotPipeline", () => {
  it("runs route, retrieval, generation, validation, and patch application", async () => {
    const tripService = createInMemoryTripService();
    const pipeline = createCopilotPipeline({ tripService });

    const result = await pipeline.run({
      message: "Plan my China trip",
      tripId: "trip-1",
      anonId: "anon-1",
    });

    expect(result.envelope.intent).toBe("trip_create");
    expect(result.trip?.id).toBe("trip-1");
    expect(result.trace.appliedPatchCount).toBe(1);
    await expect(tripService.get("trip-1")).resolves.toEqual(result.trip);
  });

  it("keeps chat-only responses from mutating trip state", async () => {
    const tripService = createInMemoryTripService();
    const pipeline = createCopilotPipeline({ tripService });

    const result = await pipeline.run({ message: "Hello there" });

    expect(result.envelope.intent).toBe("chat_only");
    expect(result.trip).toBeNull();
    expect(result.trace.appliedPatchCount).toBe(0);
  });

  it("rejects generator output that does not match CopilotEnvelope", async () => {
    const pipeline = createCopilotPipeline({
      tripService: createInMemoryTripService(),
      generateEnvelope: () => ({
        intent: "question",
        message: { headline: "Bad", body: "Bad", highlights: "not-an-array" },
      }),
    });

    await expect(pipeline.run({ message: "How does this work?" })).rejects.toThrow();
  });
});
