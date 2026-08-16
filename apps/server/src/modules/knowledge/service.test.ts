import { describe, expect, it } from "vitest";
import { createInMemoryKnowledgeService } from "./service.js";

describe("createInMemoryKnowledgeService canonical POI writes", () => {
  it("creates and updates a POI without creating or reviewing a fact", async () => {
    const service = createInMemoryKnowledgeService([], []);
    const created = await service.createPoi({
      actorId: "30000000-0000-4000-8000-000000000021",
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
      nameZh: "豫园",
      latitude: 31.227,
      longitude: 121.492,
    });

    expect(created).toMatchObject({
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
      nameZh: "豫园",
      facts: [],
    });

    const updated = await service.updatePoi({
      actorId: "30000000-0000-4000-8000-000000000021",
      id: created.id,
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
      nameZh: null,
      latitude: null,
      longitude: null,
    });

    expect(updated).toMatchObject({ id: created.id, facts: [] });
    expect(updated?.nameZh).toBeUndefined();
    expect(updated?.latitude).toBeUndefined();
    expect(updated?.longitude).toBeUndefined();
    await expect(service.listPois({ city: "Shanghai" })).resolves.toEqual([
      expect.objectContaining({ id: created.id, facts: [] }),
    ]);
  });
});
