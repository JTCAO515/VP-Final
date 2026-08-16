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

describe("createInMemoryKnowledgeService local-presentation fact writes", () => {
  it("retains per-fact provenance but rejects a generic or oversized local value", async () => {
    const service = createInMemoryKnowledgeService([], []);
    const poi = await service.createPoi({
      actorId: "30000000-0000-4000-8000-000000000021",
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
      nameZh: "豫园",
      latitude: 31.227,
      longitude: 121.492,
    });

    const fact = await service.createFact({
      poiId: poi.id,
      factType: "local_name_zh",
      value: { text: "豫园" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/official-yu-garden",
      evidenceSummary: "The official source identifies the Chinese venue name.",
    });

    expect(fact).toMatchObject({
      value: { text: "豫园" },
      sourceClass: "official",
      sourceLocator: "https://example.com/official-yu-garden",
      evidenceSummary: "The official source identifies the Chinese venue name.",
      status: "draft",
      verifiedAt: null,
    });
    await expect(
      service.updateFact({ factId: fact.id, value: { label: "wrong shape" } }),
    ).rejects.toThrow();
    await expect(
      service.updateFact({ factId: fact.id, value: { text: "x".repeat(501) } }),
    ).rejects.toThrow();
  });
});

describe("createInMemoryKnowledgeService draft review actions", () => {
  it("lists drafts without inventing import provenance and rejects one draft only", async () => {
    const service = createInMemoryKnowledgeService([], []);
    const poi = await service.createPoi({
      actorId: "30000000-0000-4000-8000-000000000021",
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
      nameZh: "豫园",
      latitude: 31.227,
      longitude: 121.492,
    });
    const draft = await service.createFact({
      poiId: poi.id,
      factType: "metro_access",
      value: { label: "Near metro" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/metro",
      evidenceSummary: "The official source confirms a nearby metro entrance.",
    });

    await expect(service.listDraftFactReviewQueue()).resolves.toEqual([
      expect.objectContaining({
        draft: expect.objectContaining({ id: draft.id, status: "draft" }),
        importContext: null,
      }),
    ]);
    await expect(
      service.listDraftFactReviewQueue({ importBatchId: "legacy-unbatched" }),
    ).resolves.toEqual([]);

    await expect(
      service.approveDraftFact({
        factId: draft.id,
        reviewedBy: "30000000-0000-4000-8000-000000000021",
        expectedVersion: draft.version,
      }),
    ).resolves.toMatchObject({ id: draft.id, status: "reviewed" });
    await expect(
      service.approveDraftFact({
        factId: draft.id,
        reviewedBy: "30000000-0000-4000-8000-000000000021",
        expectedVersion: draft.version,
      }),
    ).rejects.toThrow("no longer the unreviewed draft");
    const rejectedDraft = await service.createFact({
      poiId: poi.id,
      factType: "metro_access",
      value: { label: "Another nearby metro" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/metro-two",
      evidenceSummary: "The official source confirms another nearby metro entrance.",
    });
    await expect(
      service.renewFact({
        factId: rejectedDraft.id,
        reviewedBy: "30000000-0000-4000-8000-000000000021",
      }),
    ).rejects.toThrow("Only reviewed facts can be renewed");
    await expect(
      service.rejectFact({
        factId: rejectedDraft.id,
        rejectedBy: "30000000-0000-4000-8000-000000000021",
      }),
    ).resolves.toMatchObject({ id: rejectedDraft.id, status: "rejected" });
    await expect(service.listDraftFactReviewQueue()).resolves.toEqual([]);
    await expect(
      service.rejectFact({
        factId: rejectedDraft.id,
        rejectedBy: "30000000-0000-4000-8000-000000000021",
      }),
    ).rejects.toThrow("Only draft facts");
  });
});
