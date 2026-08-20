import { describe, expect, it } from "vitest";
import { createInMemoryKnowledgeService } from "./service.js";
import type { OpsAccess } from "../opsAuthorization/service.js";

const knowledgeEditor: OpsAccess = {
  userId: "30000000-0000-4000-8000-000000000021",
  role: "editor",
  permissions: ["knowledge.read", "knowledge.write"],
};

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

describe("createInMemoryKnowledgeService scoped execution facts", () => {
  async function createReviewedFact(
    service: ReturnType<typeof createInMemoryKnowledgeService>,
    target: Parameters<typeof service.createScopedFact>[0]["target"],
    suffix: string,
  ) {
    const draft = await service.createScopedFact({
      actor: knowledgeEditor,
      target,
      factType: "payment_acceptance",
      value: { summary: `Reviewed fixture ${suffix}` },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: `https://example.com/payment-${suffix}`,
      evidenceSummary: `Official fixture evidence ${suffix}.`,
    });
    const reviewed = await service.reviewScopedFact({
      actor: knowledgeEditor,
      factId: draft.id,
      expectedVersion: draft.version,
    });
    if (reviewed.status !== "updated") throw new Error("Fixture review failed");
    return reviewed.fact;
  }

  it("authorizes before reading or mutating a scoped fact", async () => {
    const service = createInMemoryKnowledgeService([], []);
    const unauthorized: OpsAccess = {
      userId: "30000000-0000-4000-8000-000000000022",
      role: "operator",
      permissions: [],
    };

    await expect(
      service.updateScopedFact({
        actor: unauthorized,
        factId: "missing",
        expectedVersion: 1,
        value: { summary: "must not be inspected" },
      }),
    ).rejects.toThrow("Forbidden Ops permission");
    await expect(
      service.createScopedFact({
        actor: unauthorized,
        target: { scope: "national", countryCode: "CN" },
        factType: "payment_acceptance",
        value: { summary: "must not be written" },
        confidence: 0.9,
        sourceClass: "official",
        sourceLocator: "https://example.com/blocked",
        evidenceSummary: "This input must be rejected before mutation.",
      }),
    ).rejects.toThrow("Forbidden Ops permission");
  });

  it("rejects an unbounded retrieval request before matching facts", async () => {
    const service = createInMemoryKnowledgeService([], []);
    await expect(
      service.retrieveScopedFacts({
        context: {},
        factTypes: Array.from({ length: 21 }, (_, index) => `fact-${index}`),
      }),
    ).rejects.toThrow("1-20 unique");
    await expect(service.retrieveScopedFacts({ context: {}, factTypes: [] })).rejects.toThrow(
      "1-20 unique",
    );
  });

  it("keeps a draft out of retrieval until explicit review", async () => {
    const service = createInMemoryKnowledgeService([], []);
    const draft = await service.createScopedFact({
      actor: knowledgeEditor,
      target: { scope: "national", countryCode: "CN" },
      factType: "payment_acceptance",
      value: { summary: "Reviewed only after confirmation" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/payment-draft",
      evidenceSummary: "Official fixture evidence for a draft.",
    });

    await expect(
      service.retrieveScopedFacts({ context: {}, factTypes: ["payment_acceptance"] }),
    ).resolves.toEqual({ facts: [], ambiguities: [] });
    await expect(
      service.reviewScopedFact({
        actor: knowledgeEditor,
        factId: draft.id,
        expectedVersion: draft.version,
      }),
    ).resolves.toMatchObject({ status: "updated", fact: { status: "reviewed" } });
    await expect(
      service.retrieveScopedFacts({ context: {}, factTypes: ["payment_acceptance"] }),
    ).resolves.toMatchObject({ facts: [{ id: draft.id }], ambiguities: [] });
  });

  it("uses the most specific fact and fails closed on same-level ambiguity", async () => {
    const service = createInMemoryKnowledgeService([], []);
    const national = await createReviewedFact(
      service,
      { scope: "national", countryCode: "CN" },
      "national",
    );
    const cityOne = await createReviewedFact(
      service,
      { scope: "city", city: "shanghai" },
      "city-one",
    );

    await expect(
      service.retrieveScopedFacts({
        context: { city: "Shanghai" },
        factTypes: ["payment_acceptance"],
      }),
    ).resolves.toMatchObject({ facts: [{ id: cityOne.id }], ambiguities: [] });

    const cityTwo = await createReviewedFact(
      service,
      { scope: "city", city: "shanghai" },
      "city-two",
    );
    const ambiguous = await service.retrieveScopedFacts({
      context: { city: "Shanghai" },
      factTypes: ["payment_acceptance"],
    });
    expect(ambiguous.facts).toEqual([]);
    expect(ambiguous.ambiguities).toEqual([
      {
        target: { scope: "city", city: "shanghai" },
        factType: "payment_acceptance",
        factIds: [cityOne.id, cityTwo.id].sort(),
      },
    ]);
    expect(JSON.stringify(ambiguous)).not.toContain(national.id);
  });

  it("returns an explicit conflict without overwriting a newer draft", async () => {
    const service = createInMemoryKnowledgeService([], []);
    const draft = await service.createScopedFact({
      actor: knowledgeEditor,
      target: { scope: "scene", sceneKey: "network" },
      factType: "network_setup",
      value: { summary: "Version one" },
      confidence: 0.8,
      sourceClass: "official",
      sourceLocator: "https://example.com/network-one",
      evidenceSummary: "Official fixture evidence version one.",
    });
    const updated = await service.updateScopedFact({
      actor: knowledgeEditor,
      factId: draft.id,
      expectedVersion: draft.version,
      value: { summary: "Version two" },
    });
    expect(updated).toMatchObject({ status: "updated", fact: { version: 2 } });
    await expect(
      service.updateScopedFact({
        actor: knowledgeEditor,
        factId: draft.id,
        expectedVersion: draft.version,
        value: { summary: "Stale overwrite" },
      }),
    ).resolves.toEqual({
      status: "conflict",
      reason: "stale_version",
      expectedVersion: 1,
      currentVersion: 2,
    });
  });
});
