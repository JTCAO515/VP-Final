import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryKnowledgeService } from "./service.js";

const nowExpired = "2026-07-08T00:00:00.000Z";
const reviewedEvidence = {
  source: "https://example.com/editorial-source",
  sourceClass: "reputable_editorial" as const,
  sourceLocator: "https://example.com/editorial-source",
  evidenceSummary: "The editorial source supports this execution fact.",
  ingestedAt: "2026-06-30T00:00:00.000Z",
  reviewPolicy: "execution-90d-v1" as const,
};

describe("knowledgeRouter", () => {
  it("fails closed when the composition root omits Knowledge", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
    });

    await expect(caller.knowledge.listPois()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Knowledge is unavailable.",
    });
  });

  it("lists POIs and hides expired facts", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      knowledgeService: createInMemoryKnowledgeService([
        {
          id: "poi-yu-garden",
          city: "Shanghai",
          category: "attraction",
          nameEn: "Yu Garden",
          sourceIds: {},
          commercialLinks: [],
          facts: [
            {
              id: "fact-current",
              poiId: "poi-yu-garden",
              factType: "metro_access",
              value: { easy: true },
              confidence: 0.9,
              ...reviewedEvidence,
              verifiedAt: "2026-07-01T00:00:00.000Z",
              expiresAt: "2026-09-29T00:00:00.000Z",
              version: 1,
              status: "reviewed",
            },
            {
              id: "fact-expired",
              poiId: "poi-yu-garden",
              factType: "hours",
              value: { note: "old" },
              confidence: 0.9,
              ...reviewedEvidence,
              verifiedAt: "2026-01-01T00:00:00.000Z",
              expiresAt: nowExpired,
              version: 1,
              status: "reviewed",
            },
          ],
        },
      ]),
    });

    const pois = await caller.knowledge.listPois({ city: "Shanghai", category: "attraction" });

    expect(pois).toHaveLength(1);
    expect(pois[0]?.facts.map((fact) => fact.id)).toEqual(["fact-current"]);
  });

  it("reflects edited facts through the read API", async () => {
    const knowledgeService = createInMemoryKnowledgeService();
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      knowledgeService,
    });

    await caller.knowledge.updateFact({
      factId: "fact-yu-garden-metro",
      value: { label: "Metro exit note updated from ops" },
    });

    const pois = await caller.knowledge.listPois({
      city: "Shanghai",
      category: "attraction",
      includeDrafts: true,
    });

    expect(pois[0]?.facts[0]?.value).toEqual({ label: "Metro exit note updated from ops" });
    expect(pois[0]?.facts[0]?.version).toBe(2);
    expect(pois[0]?.facts[0]).toMatchObject({ status: "draft", verifiedAt: null });
    await expect(
      caller.knowledge.listPois({ city: "Shanghai", category: "attraction" }),
    ).resolves.toMatchObject([{ facts: [] }]);
  });

  it("creates honest drafts and rejects incomplete or unsafe evidence", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      knowledgeService: createInMemoryKnowledgeService(),
    });

    await expect(
      caller.knowledge.createFact({
        poiId: "poi-shanghai-yu-garden",
        factType: "rainy_fit",
        value: { label: "Good rainy-day backup" },
        confidence: 0.7,
        sourceClass: "reputable_editorial",
        sourceLocator: "https://example.com/rain-guide",
        evidenceSummary: "The guide identifies this POI as suitable on rainy days.",
      }),
    ).resolves.toMatchObject({ factType: "rainy_fit", status: "draft", verifiedAt: null });

    await expect(
      caller.knowledge.createFact({
        poiId: "poi-shanghai-yu-garden",
        factType: "bad",
        value: { label: "Bad" },
        confidence: 0.5,
        sourceClass: "reputable_editorial",
        sourceLocator: "",
        evidenceSummary: "Email editor@example.com for proof.",
      }),
    ).rejects.toThrow();
  });

  it("supports expired fact review, renewal, and deprecation", async () => {
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
            id: "fact-expired",
            poiId: "poi-yu-garden",
            factType: "hours",
            value: { note: "old" },
            confidence: 0.9,
            ...reviewedEvidence,
            verifiedAt: "2026-01-01T00:00:00.000Z",
            expiresAt: nowExpired,
            version: 1,
            status: "reviewed",
          },
        ],
      },
    ]);
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      knowledgeService,
    });

    await expect(caller.knowledge.listExpiredFacts()).resolves.toHaveLength(1);
    await expect(caller.knowledge.renewFact({ factId: "fact-expired" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      knowledgeService.renewFact({
        factId: "fact-expired",
        reviewedBy: "30000000-0000-4000-8000-000000000010",
      }),
    ).resolves.toMatchObject({ version: 2, reviewPolicy: "volatile-30d-v1" });
    await expect(caller.knowledge.listExpiredFacts()).resolves.toHaveLength(0);
    await caller.knowledge.deprecateFact({ factId: "fact-expired" });
    await expect(caller.knowledge.listPois({ includeDeprecated: true })).resolves.toMatchObject([
      { facts: [{ status: "deprecated" }] },
    ]);
    await expect(caller.knowledge.listPois()).resolves.toMatchObject([{ facts: [] }]);
  });

  it("refuses to review a draft backed only by model output", async () => {
    const knowledgeService = createInMemoryKnowledgeService();
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      knowledgeService,
    });
    const created = await caller.knowledge.createFact({
      poiId: "poi-shanghai-yu-garden",
      factType: "hours",
      value: { label: "Uncorroborated opening hours" },
      confidence: 0.4,
      sourceClass: "model_output",
      sourceLocator: "internal://model-run/run-1",
      evidenceSummary: "A model suggested these hours without independent evidence.",
    });

    await expect(
      knowledgeService.renewFact({
        factId: created.id,
        reviewedBy: "30000000-0000-4000-8000-000000000010",
      }),
    ).rejects.toThrow("independently reviewable evidence");
  });

  it("clusters and resolves knowledge gaps", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      knowledgeService: createInMemoryKnowledgeService([], []),
    });

    const first = await caller.knowledge.recordGap({
      question: "How do I use a foreign card in Shanghai?",
      city: "Shanghai",
    });
    const second = await caller.knowledge.recordGap({
      question: "How do I use a foreign card in Shanghai!",
      city: "Shanghai",
    });

    expect(second.id).toBe(first.id);
    expect(second.frequency).toBe(2);

    await caller.knowledge.updateGap({
      gapId: first.id,
      status: "resolved",
      resolutionTarget: { kind: "guide", id: "payment" },
    });

    await expect(caller.knowledge.listGaps({ status: "open" })).resolves.toEqual([]);
    await expect(caller.knowledge.listGaps({ status: "resolved" })).resolves.toMatchObject([
      { id: first.id, status: "resolved", resolutionTarget: { kind: "guide", id: "payment" } },
    ]);
  });
});
