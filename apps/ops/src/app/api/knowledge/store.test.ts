import { describe, expect, it } from "vitest";
import type { Poi, PoiFact } from "@visepanda/domain";
import { getKnowledgeService } from "./store";

describe("ops knowledge store", () => {
  it("reflects edited facts through the read store", async () => {
    const service = getKnowledgeService();
    await service.updateFact({
      factId: "fact-yu-garden-metro",
      value: { label: "Metro: Yuyuan Garden Station" },
    });

    const fact = (await service.listPois())
      .flatMap((poi: Poi) => poi.facts)
      .find((candidate: PoiFact) => candidate.id === "fact-yu-garden-metro");

    expect(fact?.value).toEqual({ label: "Metro: Yuyuan Garden Station" });
    expect(fact?.version).toBe(2);
  });
});
