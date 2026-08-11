import { describe, expect, it, vi } from "vitest";
import { createInMemoryKnowledgeService } from "../knowledge/service.js";
import { createInMemoryTelemetryService } from "../telemetry/service.js";
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

  it("records only allowlisted Copilot telemetry after a successful skeleton response", async () => {
    const telemetryService = createInMemoryTelemetryService();
    const pipeline = createCopilotPipeline({
      telemetryService,
      tripService: createVersionedInMemoryTripService(),
    });

    const result = await pipeline.run({ message: "Plan my China trip" }, identity);
    const events = await telemetryService.list();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anon_id: identity.anonId,
          action: "prompt_submitted",
          entity_type: "trip",
          entity_id: result.trip?.id,
          intent: "trip_create",
          props_jsonb: {},
        }),
        expect.objectContaining({
          action: "patch_applied",
          entity_id: result.trip?.id,
          intent: "trip_create",
          props_jsonb: {},
        }),
        expect.objectContaining({
          action: "skeleton_received",
          entity_id: result.trip?.id,
          intent: "trip_create",
          props_jsonb: {},
        }),
      ]),
    );
    expect(JSON.stringify(events)).not.toContain("Plan my China trip");
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
    const telemetryService = createInMemoryTelemetryService();
    const pipeline = createCopilotPipeline({
      telemetryService,
      tripService: createVersionedInMemoryTripService(),
    });

    const result = await pipeline.run(
      { message: "I need human help to call a Beijing hotel" },
      identity,
    );

    expect(result.envelope.intent).toBe("human_help");
    expect(result.envelope.humanHelp).toMatchObject({
      kind: "task",
      city: "Beijing",
    });
    await expect(telemetryService.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "human_help_suggested",
          intent: "human_help",
          props_jsonb: { city: "Beijing", kind: "task" },
        }),
      ]),
    );
  });

  it("bypasses free generation for a high-risk request and returns only its exact reviewed phrase", async () => {
    const generateEnvelope = vi.fn(() => {
      throw new Error("high-risk requests must not reach the generator");
    });
    const selection = {
      category: "allergy_dietary" as const,
      scene: "restaurant" as const,
      intentKey: "peanut-allergy",
      variantKey: "plain",
      severity: "severe" as const,
    };
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      generateEnvelope,
      resolveSafePhrase: async () => ({
        id: "8ad64607-dc57-4d5b-8dfb-3d2813aac985",
        ...selection,
        chineseExpression: "我对花生严重过敏。",
        englishIntent: "I have a severe peanut allergy.",
        sourceClass: "operator_verified",
        sourceLocator: "ops://safe-phrase/peanut-allergy",
        evidenceSummary: "Reviewed by a qualified operator.",
        verifiedBy: "a75ea05d-0146-4ba5-ae21-7374c623967a",
        verifiedAt: "2026-08-10T00:00:00.000Z",
        expiresAt: "2026-09-01T00:00:00.000Z",
        reviewPolicy: "operator-verified-90d-v1",
        status: "reviewed",
        createdAt: "2026-08-10T00:00:00.000Z",
      }),
    });

    await expect(
      pipeline.run(
        { message: "I have a severe peanut allergy", safePhraseSelection: selection },
        identity,
      ),
    ).resolves.toMatchObject({
      envelope: { message: { body: "我对花生严重过敏。" }, humanHelp: null },
    });
    expect(generateEnvelope).not.toHaveBeenCalled();
  });

  it("returns the frozen unavailable response and does not fall back to model generation", async () => {
    const generateEnvelope = vi.fn(() => {
      throw new Error("high-risk requests must not reach the generator");
    });
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      generateEnvelope,
      resolveSafePhrase: async () => null,
    });

    await expect(
      pipeline.run({ message: "I have a severe peanut allergy" }, identity),
    ).resolves.toMatchObject({
      envelope: {
        message: {
          body: "I can’t safely create a card for this allergy or dietary restriction. Please use a verified card or ask the venue to confirm ingredients before consuming.",
        },
        humanHelp: { kind: "task" },
      },
    });
    expect(generateEnvelope).not.toHaveBeenCalled();
  });

  it("rejects unsupported execution facts before a response can mutate a Trip", async () => {
    const tripService = createVersionedInMemoryTripService();
    const pipeline = createCopilotPipeline({
      tripService,
      routeIntent: () => "question",
      retrieveContext: () => [
        {
          id: "fact-metro",
          label: "Yu Garden: metro access",
          summary: "Near Metro Line 10",
          source: "official",
          verifiedAt: "2026-08-10T00:00:00.000Z",
          confidence: 1,
          supportingValues: ["Metro Line 10"],
        },
      ],
      generateEnvelope: () => ({
        intent: "question",
        message: {
          headline: "Route",
          body: "Take Metro Line 99.",
          highlights: [],
        },
        citations: [{ fact_id: "fact-metro" }],
      }),
    });

    await expect(pipeline.run({ message: "How should I get there?" }, identity)).rejects.toThrow(
      "No answer was generated or invented.",
    );
    await expect(tripService.list(identity)).resolves.toEqual([]);
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

  it("retrieves only the uniquely resolved POI and returns no facts for an unknown place", async () => {
    const now = new Date();
    const verifiedAt = now.toISOString();
    const expiresAt = new Date(now.valueOf() + 24 * 60 * 60 * 1000).toISOString();
    const knowledgeService = createInMemoryKnowledgeService([
      {
        id: "poi-shanghai-bund",
        city: "Shanghai",
        category: "attraction",
        nameEn: "The Bund",
        nameZh: "外滩",
        sourceIds: {},
        commercialLinks: [],
        facts: [
          {
            id: "fact-bund-metro",
            poiId: "poi-shanghai-bund",
            factType: "metro_access",
            value: { label: "Bund fact" },
            confidence: 0.9,
            source: "https://example.com/bund",
            sourceClass: "official",
            sourceLocator: "https://example.com/bund",
            evidenceSummary: "Official information for the Bund metro access.",
            ingestedAt: verifiedAt,
            verifiedAt,
            expiresAt,
            reviewPolicy: "execution-90d-v1",
            version: 1,
            status: "reviewed",
          },
        ],
      },
      {
        id: "poi-shanghai-other",
        city: "Shanghai",
        category: "attraction",
        nameEn: "Other Shanghai Place",
        sourceIds: {},
        commercialLinks: [],
        facts: [
          {
            id: "fact-other",
            poiId: "poi-shanghai-other",
            factType: "metro_access",
            value: { label: "Other fact" },
            confidence: 0.9,
            source: "https://example.com/other",
            sourceClass: "official",
            sourceLocator: "https://example.com/other",
            evidenceSummary: "Official information for another Shanghai attraction.",
            ingestedAt: verifiedAt,
            verifiedAt,
            expiresAt,
            reviewPolicy: "execution-90d-v1",
            version: 1,
            status: "reviewed",
          },
        ],
      },
    ]);
    const retrievedFactIds: string[][] = [];
    const pipeline = createCopilotPipeline({
      knowledgeService,
      tripService: createVersionedInMemoryTripService(),
      routeIntent: () => "question",
      generateEnvelope: ({ intent, retrievedFacts }) => {
        retrievedFactIds.push(retrievedFacts.map((fact) => fact.id));
        return {
          intent,
          message: { headline: "Grounded", body: "Evidence only.", highlights: [] },
          citations: [],
        };
      },
    });

    await pipeline.run({ message: "Where can I eat near 外滩?" }, identity);
    await pipeline.run({ message: "How do I get to an imaginary landmark?" }, identity);

    expect(retrievedFactIds).toEqual([["fact-bund-metro"], []]);
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

    await expect(
      pipeline.run({ message: "How does this work? Email alex@example.com" }, identity),
    ).rejects.toThrow();
    expect(traceService.listRuns()).toMatchObject([
      {
        identity,
        status: "failed",
        validationStatus: "failed",
        failureClass: "validation_error",
      },
    ]);
    const serialized = JSON.stringify(traceService.listRuns());
    expect(serialized).toContain("How does this work? Email [redacted email]");
    expect(serialized).not.toContain("alex@example.com");
  });

  it("records a normalized failure class without retaining the prompt when generation fails", async () => {
    const telemetryService = createInMemoryTelemetryService();
    const pipeline = createCopilotPipeline({
      telemetryService,
      tripService: createVersionedInMemoryTripService(),
      routeIntent: () => "question",
      generateEnvelope: () => {
        throw new Error("provider timeout");
      },
    });

    await expect(
      pipeline.run({ message: "My private prompt is alex@example.com" }, identity),
    ).rejects.toThrow("provider timeout");
    const events = await telemetryService.list();
    expect(events).toEqual([
      expect.objectContaining({
        action: "copilot_failed",
        intent: "question",
        entity_type: "copilot_session",
        props_jsonb: { failureClass: "timeout" },
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("alex@example.com");
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

  it("records a redacted anonymous conversation without retaining restricted material", async () => {
    const traceService = createInMemoryAgentTraceService();
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      traceService,
      generateEnvelope: () => ({
        intent: "chat_only",
        message: {
          headline: "Account follow-up",
          body: "We will not repeat cookie=session-secret or alex@example.com.",
          highlights: [],
        },
        tripActions: [],
        toolCards: [],
        commercialActions: [],
        humanHelp: null,
        citations: [],
      }),
    });

    await pipeline.run(
      {
        message:
          "Email alex@example.com, travel document number is E12345678, cookie=session-secret, signature=abc123def456",
      },
      identity,
    );

    expect(traceService.listRuns()).toMatchObject([
      {
        identity,
        status: "succeeded",
        validationStatus: "passed",
        attempts: [],
        conversation: {
          userMessage:
            "Email [redacted email], [redacted travel document], [redacted cookie], [redacted signature]",
          assistantEnvelope: {
            message: {
              body: "We will not repeat [redacted cookie] or [redacted email].",
            },
          },
          redactionClasses: ["cookie", "email", "signature", "travel_document"],
        },
      },
    ]);
    const serialized = JSON.stringify(traceService.listRuns());
    expect(serialized).not.toContain("alex@example.com");
    expect(serialized).not.toContain("E12345678");
    expect(serialized).not.toContain("session-secret");
    expect(serialized).not.toContain("abc123def456");
  });

  it("does not fail a successful Copilot response when trace persistence fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
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
    expect(warn).toHaveBeenCalledWith("copilot_observability_write_failed", {
      failureClass: "persistence_error",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("trace database unavailable");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Hello there");
    warn.mockRestore();
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

  it("records billed attempts when every envelope repair candidate is invalid", async () => {
    const traceService = createInMemoryAgentTraceService();
    const pipeline = createCopilotPipeline({
      tripService: createVersionedInMemoryTripService(),
      traceService,
      generateEnvelope: () => ({
        candidate: "not a Copilot envelope",
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
    });

    await expect(pipeline.run({ message: "Help me" }, identity)).rejects.toThrow(
      "Copilot envelope validation failed",
    );
    expect(traceService.listRuns()).toMatchObject([
      {
        status: "failed",
        failureClass: "validation_error",
        attempts: [
          {
            provider: "concierge_primary",
            inputTokens: 10,
            outputTokens: 20,
          },
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
