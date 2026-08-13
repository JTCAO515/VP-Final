import { describe, expect, it } from "vitest";
import { createInMemorySeoEditorialOverrideService } from "./editorialOverrideService.js";

const POI_ID = "8bdf3a4e-541b-4e01-a1f8-fec4546b7061";
const ACTOR_ID = "30000000-0000-4000-8000-000000000021";

describe("SEO editorial override service", () => {
  it("keeps only bounded presentation data and deletion restores absence", async () => {
    const service = createInMemorySeoEditorialOverrideService({
      now: () => new Date("2026-08-14T00:00:00.000Z"),
    });

    const saved = await service.save({
      actorId: ACTOR_ID,
      poiId: POI_ID,
      intent: "transport",
      title: "Getting to Yu Garden",
      summary: null,
      emphasis: "Check the current route before you leave.",
    });

    expect(saved).toEqual({
      poiId: POI_ID,
      intent: "transport",
      title: "Getting to Yu Garden",
      summary: null,
      emphasis: "Check the current route before you leave.",
      updatedAt: "2026-08-14T00:00:00.000Z",
    });
    expect(await service.get({ poiId: POI_ID, intent: "transport" })).toEqual(saved);
    expect(await service.delete({ actorId: ACTOR_ID, poiId: POI_ID, intent: "transport" })).toBe(
      true,
    );
    expect(await service.get({ poiId: POI_ID, intent: "transport" })).toBeNull();
  });

  it("rejects a write with no presentation replacement", async () => {
    const service = createInMemorySeoEditorialOverrideService();
    await expect(
      service.save({
        actorId: ACTOR_ID,
        poiId: POI_ID,
        intent: "transport",
        title: null,
        summary: null,
        emphasis: null,
      }),
    ).rejects.toThrow("An editorial override");
  });
});
