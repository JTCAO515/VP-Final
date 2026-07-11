import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryKnowledgeService } from "./service.js";

const nowExpired = "2026-07-08T00:00:00.000Z";

describe("knowledgeRouter", () => {
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
              source: "editor",
              verifiedAt: "2026-07-01T00:00:00.000Z",
              expiresAt: null,
              version: 1,
              status: "active",
            },
            {
              id: "fact-expired",
              poiId: "poi-yu-garden",
              factType: "hours",
              value: { note: "old" },
              confidence: 0.9,
              source: "editor",
              verifiedAt: "2026-01-01T00:00:00.000Z",
              expiresAt: nowExpired,
              version: 1,
              status: "active",
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

    const pois = await caller.knowledge.listPois({ city: "Shanghai", category: "attraction" });

    expect(pois[0]?.facts[0]?.value).toEqual({ label: "Metro exit note updated from ops" });
    expect(pois[0]?.facts[0]?.version).toBe(2);
  });

  it("creates facts and rejects missing source or confidence", async () => {
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
        source: "editorial",
      }),
    ).resolves.toMatchObject({ factType: "rainy_fit", status: "active" });

    await expect(
      caller.knowledge.createFact({
        poiId: "poi-shanghai-yu-garden",
        factType: "bad",
        value: { label: "Bad" },
        confidence: 0.5,
        source: "",
      }),
    ).rejects.toThrow();
  });

  it("supports expired fact review, renewal, and deprecation", async () => {
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
              id: "fact-expired",
              poiId: "poi-yu-garden",
              factType: "hours",
              value: { note: "old" },
              confidence: 0.9,
              source: "editor",
              verifiedAt: "2026-01-01T00:00:00.000Z",
              expiresAt: nowExpired,
              version: 1,
              status: "active",
            },
          ],
        },
      ]),
    });

    await expect(caller.knowledge.listExpiredFacts()).resolves.toHaveLength(1);
    await expect(caller.knowledge.renewFact({ factId: "fact-expired" })).resolves.toMatchObject({
      expiresAt: null,
      version: 2,
    });
    await expect(caller.knowledge.listExpiredFacts()).resolves.toHaveLength(0);
    await caller.knowledge.deprecateFact({ factId: "fact-expired" });
    await expect(caller.knowledge.listPois({ includeDeprecated: true })).resolves.toMatchObject([
      { facts: [{ status: "deprecated" }] },
    ]);
    await expect(caller.knowledge.listPois()).resolves.toMatchObject([{ facts: [] }]);
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
