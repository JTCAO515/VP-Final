import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createInMemoryTripService } from "../trip/service.js";
import { createInMemoryKnowledgeService } from "./service.js";

const nowExpired = "2026-07-08T00:00:00.000Z";

describe("knowledgeRouter", () => {
  it("lists POIs and hides expired facts", async () => {
    const caller = appRouter.createCaller({
      tripService: createInMemoryTripService(),
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
      tripService: createInMemoryTripService(),
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
});
