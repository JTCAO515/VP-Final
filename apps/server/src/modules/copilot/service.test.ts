import { describe, expect, it } from "vitest";
import { createInMemoryKnowledgeService } from "../knowledge/service.js";
import { createInMemoryAgentTraceService } from "../trace/service.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
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
  const identity = { kind: "anonymous" as const, anonId: "anon-1" };

  it("runs route, retrieval, generation, validation, and patch application", async () => {
    const tripService = createVersionedInMemoryTripService();
    const pipeline = createCopilotPipeline({ tripService });

    const result = await pipeline.run(
      {
        message: "Plan my China trip",
      },
      identity,
    );

    expect(result.envelope.intent).toBe("trip_create");
    expect(result.trip?.id).toBeTruthy();
    expect(result.trace.appliedPatchCount).toBe(1);
    await expect(tripService.get(result.trip?.id ?? "", identity)).resolves.toMatchObject({
      trip: result.trip,
    });
  });

  it("keeps chat-only responses from mutating trip state", async () => {
    const tripService = createVersionedInMemoryTripService();
    const pipeline = createCopilotPipeline({ tripService });

    const result = await pipeline.run({ message: "Hello there" }, identity);

    expect(result.envelope.intent).toBe("chat_only");
    expect(result.trip).toBeNull();
    expect(result.trace.appliedPatchCount).toBe(0);
  });

  it("does not create a caller-selected Trip id when the referenced Trip is unavailable", async () => {
    const tripService = createVersionedInMemoryTripService();
    const pipeline = createCopilotPipeline({ tripService });

    await expect(
      pipeline.run({ message: "Plan a trip", tripId: "unavailable-trip" }, identity),
    ).rejects.toThrow("Trip not found");
    await expect(tripService.list(identity)).resolves.toEqual([]);
  });

  it("returns disclosed commercial actions only for commerce intent", async () => {
    const pipeline = createCopilotPipeline({ tripService: createVersionedInMemoryTripService() });

    const result = await pipeline.run({ message: "Can I book a Shanghai hotel?" }, identity);

    expect(result.envelope.intent).toBe("commerce_intent");
    expect(result.envelope.commercialActions[0]).toMatchObject({
      kind: "outbound_link",
      partner: "tripcom",
    });
    expect(result.envelope.commercialActions[0]?.disclosure).toContain("commission");
  });

  it("returns editable human help prefill when handoff is needed", async () => {
    const pipeline = createCopilotPipeline({ tripService: createVersionedInMemoryTripService() });

    const result = await pipeline.run(
      { message: "I need human help to call a Beijing hotel" },
      identity,
    );

    expect(result.envelope.intent).toBe("human_help");
    expect(result.envelope.humanHelp).toMatchObject({
      kind: "task",
      city: "Beijing",
    });
  });

  it("records knowledge gaps for uncited question answers", async () => {
    const knowledgeService = createInMemoryKnowledgeService([], []);
    const pipeline = createCopilotPipeline({
      knowledgeService,
      tripService: createVersionedInMemoryTripService(),
      generateEnvelope: () => ({
        intent: "question",
        message: { headline: "Unknown", body: "I do not know yet.", highlights: [] },
        citations: [],
      }),
    });

    await pipeline.run({ message: "What is the newest payment rule in Shanghai?" }, identity);

    await expect(knowledgeService.listGaps({ status: "open" })).resolves.toMatchObject([
      {
        city: "Shanghai",
        frequency: 1,
        questionPattern: "what is the newest payment rule in shanghai",
      },
    ]);
  });

  it("rejects generator output that does not match CopilotEnvelope", async () => {
    const traceService = createInMemoryAgentTraceService();
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      traceService,
      generateEnvelope: () => ({
        intent: "question",
        message: { headline: "Bad", body: "Bad", highlights: "not-an-array" },
      }),
    });

    await expect(pipeline.run({ message: "How does this work?" }, identity)).rejects.toThrow();
    expect(traceService.listRuns()).toMatchObject([
      {
        identity,
        status: "failed",
        validationStatus: "failed",
        failureClass: "validation_error",
      },
    ]);
    expect(JSON.stringify(traceService.listRuns())).not.toContain("How does this work?");
  });

  it("records anonymous success without retaining prompt or response text", async () => {
    const traceService = createInMemoryAgentTraceService();
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      traceService,
    });

    await pipeline.run({ message: "Private travel request" }, identity);

    expect(traceService.listRuns()).toMatchObject([
      {
        identity,
        status: "succeeded",
        validationStatus: "passed",
        attempts: [],
      },
    ]);
    const serialized = JSON.stringify(traceService.listRuns());
    expect(serialized).not.toContain("Private travel request");
    expect(serialized).not.toContain("I can help");
  });

  it("does not fail a successful Copilot response when trace persistence fails", async () => {
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      traceService: {
        async recordRun() {
          throw new Error("trace database unavailable");
        },
      },
    });

    await expect(pipeline.run({ message: "Hello there" }, identity)).resolves.toMatchObject({
      envelope: { intent: "chat_only" },
    });
  });
});
