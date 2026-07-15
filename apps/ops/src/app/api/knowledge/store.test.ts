import type { Poi, PoiFact } from "@visepanda/domain";
import { createInMemoryKnowledgeService } from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getKnowledgeService, setTestOpsKnowledgeService } from "./store";

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  setTestOpsKnowledgeService(createInMemoryKnowledgeService());
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  setTestOpsKnowledgeService(null);
});

describe("ops knowledge store", () => {
  it("reflects edited facts through the read store", async () => {
    const service = getKnowledgeService();
    await service.updateFact({
      factId: "fact-yu-garden-metro",
      value: { label: "Metro: Yuyuan Garden Station" },
    });

    const fact = (await service.listPois({ includeDrafts: true }))
      .flatMap((poi: Poi) => poi.facts)
      .find((candidate: PoiFact) => candidate.id === "fact-yu-garden-metro");

    expect(fact?.value).toEqual({ label: "Metro: Yuyuan Garden Station" });
    expect(fact?.version).toBe(2);
    expect(fact).toMatchObject({ status: "draft", verifiedAt: null });
    const publicFact = (await service.listPois())
      .flatMap((poi: Poi) => poi.facts)
      .find((candidate: PoiFact) => candidate.id === "fact-yu-garden-metro");
    expect(publicFact).toBeUndefined();
  });
});
