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

  it("grounds citations in eligible retrieved facts and ignores expired evidence", async () => {
    const knowledgeService = createInMemoryKnowledgeService([
      {
        id: "poi-yu-garden",
        city: "Shanghai",
        category: "attraction",
        nameEn: "Yu Garden",
        sourceIds: {},
        commercialLinks: [],
        facts: [
          {
            id: "fact-reviewed",
            poiId: "poi-yu-garden",
            factType: "metro_access",
            value: { label: "Near Yuyuan Garden station" },
            confidence: 0.9,
            source: "editorial-review",
            sourceClass: "reputable_editorial",
            sourceLocator: "https://example.com/yu-garden-metro",
            evidenceSummary: "The editorial source confirms nearby metro access.",
            ingestedAt: "2026-07-09T00:00:00.000Z",
            verifiedAt: "2026-07-10T00:00:00.000Z",
            expiresAt: "2026-10-08T00:00:00.000Z",
            reviewPolicy: "execution-90d-v1",
            version: 1,
            status: "reviewed",
          },
          {
            id: "fact-expired",
            poiId: "poi-yu-garden",
            factType: "hours",
            value: { label: "Old hours" },
            confidence: 0.9,
            source: "editorial-review",
            sourceClass: "reputable_editorial",
            sourceLocator: "https://example.com/yu-garden-hours",
            evidenceSummary: "The editorial source published the old opening hours.",
            ingestedAt: "2026-01-01T00:00:00.000Z",
            verifiedAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2026-07-01T00:00:00.000Z",
            reviewPolicy: "volatile-30d-v1",
            version: 1,
            status: "reviewed",
          },
        ],
      },
    ]);
    const pipeline = createCopilotPipeline({
      knowledgeService,
      tripService: createVersionedInMemoryTripService(),
      generateEnvelope: ({ intent, retrievedFacts }) => ({
        intent,
        message: { headline: "Grounded", body: "Use the metro.", highlights: [] },
        citations: retrievedFacts.map((fact) => ({
          fact_id: fact.id,
          label: "Model-controlled label",
          source: "Model-controlled source",
        })),
      }),
    });

    const result = await pipeline.run(
      { message: "How do I get to Yu Garden in Shanghai?" },
      identity,
    );

    expect(result.trace.retrievedFactIds).toEqual(["fact-reviewed"]);
    expect(result.envelope.citations).toEqual([
      {
        fact_id: "fact-reviewed",
        label: "Yu Garden: metro_access",
        source: "reputable_editorial",
      },
    ]);
  });

  it("rejects citations that are outside the retrieval allowlist", async () => {
    const knowledgeService = createInMemoryKnowledgeService([], []);
    const pipeline = createCopilotPipeline({
      knowledgeService,
      tripService: createVersionedInMemoryTripService(),
      generateEnvelope: ({ intent }) => ({
        intent,
        message: { headline: "Ungrounded", body: "No.", highlights: [] },
        citations: [{ fact_id: "invented-fact" }],
      }),
    });

    await expect(pipeline.run({ message: "How does payment work?" }, identity)).rejects.toThrow(
      "Citation does not reference retrieved evidence",
    );
  });

  it("returns an honest no-evidence answer and redacts PII from the stored gap", async () => {
    const knowledgeService = createInMemoryKnowledgeService([], []);
    const pipeline = createCopilotPipeline({
      knowledgeService,
      tripService: createVersionedInMemoryTripService(),
    });

    const result = await pipeline.run(
      { message: "What is the newest rule? Contact me at alex@example.com or +1 415 555 0123" },
      identity,
    );

    expect(result.envelope.message.headline).toBe("Not enough verified information yet");
    await expect(knowledgeService.listGaps({ status: "open" })).resolves.toMatchObject([
      { questionPattern: "what is the newest rule contact me at private email or private number" },
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

  it("repairs a string message from real providers into the typed message object", async () => {
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      traceService: createInMemoryAgentTraceService(),
      routeIntent: () => "question",
      generateEnvelope: () =>
        JSON.stringify({
          intent: "question",
          message: "Set up Alipay or WeChat Pay before you leave the airport.",
          tripActions: [],
          toolCards: [],
          commercialActions: [],
          humanHelp: null,
          citations: [],
        }),
    });

    const result = await pipeline.run({ message: "How should I prepare payments?" }, identity);

    expect(result.envelope.message).toEqual({
      headline: "China travel answer",
      body: "Set up Alipay or WeChat Pay before you leave the airport.",
      highlights: [],
    });
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

  it("repairs a bounded JSON envelope response and records provider attempts", async () => {
    const traceService = createInMemoryAgentTraceService();
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      traceService,
      routeIntent: () => ({
        intent: "question",
        attempts: [
          {
            provider: "router_primary",
            model: "router-model",
            status: "succeeded",
            inputTokens: 3,
            outputTokens: 2,
            costUsd: 0,
            latencyMs: 12,
          },
        ],
      }),
      generateEnvelope: () => ({
        candidate:
          'Here is the envelope: {"intent":"question","message":{"headline":"Payment","body":"Use an international card to fund a supported wallet.","highlights":["Carry a backup card",]},"tripActions":[],"toolCards":[],"commercialActions":[],"humanHelp":null,}',
        attempts: [
          {
            provider: "concierge_primary",
            model: "concierge-model",
            status: "succeeded",
            inputTokens: 10,
            outputTokens: 20,
            costUsd: 0.01,
            latencyMs: 123,
          },
        ],
      }),
      demoDialogueOnly: true,
    });

    await expect(
      pipeline.run({ message: "How should I prepare payments?" }, identity),
    ).resolves.toMatchObject({
      envelope: { intent: "question", tripActions: [], commercialActions: [] },
    });
    expect(traceService.listRuns()).toMatchObject([
      {
        status: "succeeded",
        repairCount: 1,
        attempts: [
          { provider: "router_primary", status: "succeeded" },
          { provider: "concierge_primary", status: "succeeded", costUsd: 0.01 },
        ],
      },
    ]);
  });

  it("rejects non-dialogue output in DEMO-01 before it can create a Trip", async () => {
    const tripService = createVersionedInMemoryTripService();
    const pipeline = createCopilotPipeline({
      tripService,
      routeIntent: () => "trip_create",
      generateEnvelope: () => ({
        intent: "trip_create",
        message: { headline: "Created", body: "This must not be applied.", highlights: [] },
        tripActions: [
          {
            operations: [
              {
                op: "create_trip",
                trip: {
                  id: crypto.randomUUID(),
                  title: "Blocked",
                  destinationCountry: "CN",
                  days: [],
                },
              },
            ],
          },
        ],
      }),
      demoDialogueOnly: true,
    });

    await expect(pipeline.run({ message: "Plan a trip" }, identity)).rejects.toThrow(
      "DEMO-01 only permits a dialogue envelope",
    );
    await expect(tripService.list(identity)).resolves.toEqual([]);
  });

  it("rejects a citation-only envelope in DEMO-01", async () => {
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      routeIntent: () => "question",
      generateEnvelope: () => ({
        intent: "question",
        message: {
          headline: "Source",
          body: "This must stay hidden for the demo.",
          highlights: [],
        },
        citations: [{ fact_id: "fact-1", label: "Not yet delivered" }],
      }),
      demoDialogueOnly: true,
    });

    await expect(pipeline.run({ message: "Can I pay by card?" }, identity)).rejects.toThrow(
      "DEMO-01 only permits a dialogue envelope",
    );
  });
});
