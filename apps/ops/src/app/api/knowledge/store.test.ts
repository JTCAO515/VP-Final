import { describe, expect, it } from "vitest";
import { listPois, updateFact } from "./store";

describe("ops knowledge store", () => {
  it("reflects edited facts through the read store", () => {
    updateFact("fact-yu-garden-metro", { label: "Metro: Yuyuan Garden Station" });

    const fact = listPois()
      .flatMap((poi) => poi.facts)
      .find((candidate) => candidate.id === "fact-yu-garden-metro");

    expect(fact?.value).toEqual({ label: "Metro: Yuyuan Garden Station" });
    expect(fact?.version).toBe(2);
  });
});
