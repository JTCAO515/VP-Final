import {
  INITIAL_KNOWLEDGE_GAPS,
  INITIAL_POIS,
  hasReviewablePoiFactEvidence,
  isEligiblePoiFact,
  KnowledgeGapSchema,
  PoiFactEvidenceSchema,
  parsePoiFactWriteValue,
  PoiCreateInputSchema,
  DraftFactReviewQueueFilterSchema,
  DraftFactReviewQueueItemSchema,
  PoiSchema,
  PoiUpdateInputSchema,
  sanitizeEvidenceDerivedGapPattern,
  resolvePoiFactReview,
  ScopedExecutionFactSchema,
  deriveExecutionFactTargetOrder,
  executionFactTargetKey,
  isEligibleScopedExecutionFact,
  resolveExecutionFactVersion,
  updatePoiFact,
  type KnowledgeGap,
  type DraftFactReviewQueueFilter,
  type DraftFactReviewQueueItem,
  type Poi,
  type PoiCategory,
  type PoiCreateInput,
  type PoiFact,
  type PoiFactSourceClass,
  type PoiUpdateInput,
  type ExecutionFactRetrievalContext,
  type ExecutionFactTarget,
  type ScopedExecutionFact,
} from "@visepanda/domain";
import type { OpsAccess } from "../opsAuthorization/service.js";

export type ScopedFactWriteResult =
  | { status: "updated"; fact: ScopedExecutionFact }
  | { status: "not_found" }
  | {
      status: "conflict";
      reason: "target_missing" | "stale_version" | "not_reviewable";
      expectedVersion: number;
      currentVersion: number | null;
    };

export type ScopedFactRetrievalResult = {
  facts: ScopedExecutionFact[];
  ambiguities: Array<{ target: ExecutionFactTarget; factType: string; factIds: string[] }>;
};

export type ResolvedScopedFactRetrievalInput = {
  targets: ExecutionFactTarget[];
  factTypes: string[];
  now: Date;
};

export type KnowledgeService = {
  listPois(input?: {
    city?: string;
    category?: PoiCategory;
    includeExpired?: boolean;
    includeDeprecated?: boolean;
    includeDrafts?: boolean;
  }): Promise<Poi[]>;
  createPoi(input: PoiCreateInput & { actorId: string }): Promise<Poi>;
  updatePoi(input: PoiUpdateInput & { actorId: string }): Promise<Poi | null>;
  createFact(input: {
    poiId: string;
    factType: string;
    value: Record<string, unknown>;
    confidence: number;
    sourceClass: PoiFactSourceClass;
    sourceLocator: string;
    evidenceSummary: string;
    expiresAt?: string | null;
  }): Promise<PoiFact>;
  updateFact(input: {
    factId: string;
    value: Record<string, unknown>;
    confidence?: number;
    sourceClass?: PoiFactSourceClass;
    sourceLocator?: string;
    evidenceSummary?: string;
    expiresAt?: string | null;
  }): Promise<Poi[]>;
  createScopedFact(input: {
    actor: OpsAccess;
    target: ExecutionFactTarget;
    factType: string;
    value: Record<string, unknown>;
    confidence: number;
    sourceClass: PoiFactSourceClass;
    sourceLocator: string;
    evidenceSummary: string;
    expiresAt?: string | null;
  }): Promise<ScopedExecutionFact>;
  updateScopedFact(input: {
    actor: OpsAccess;
    factId: string;
    expectedVersion: number;
    value: Record<string, unknown>;
    confidence?: number;
    sourceClass?: PoiFactSourceClass;
    sourceLocator?: string;
    evidenceSummary?: string;
    expiresAt?: string | null;
  }): Promise<ScopedFactWriteResult>;
  reviewScopedFact(input: {
    actor: OpsAccess;
    factId: string;
    expectedVersion: number;
  }): Promise<ScopedFactWriteResult>;
  deprecateScopedFact(input: {
    actor: OpsAccess;
    factId: string;
    expectedVersion: number;
  }): Promise<ScopedFactWriteResult>;
  retrieveScopedFacts(input: {
    context: ExecutionFactRetrievalContext;
    factTypes: string[];
    now?: Date;
  }): Promise<ScopedFactRetrievalResult>;
  listExpiredFacts(input?: { now?: Date }): Promise<PoiFact[]>;
  listDraftFactReviewQueue(input?: DraftFactReviewQueueFilter): Promise<DraftFactReviewQueueItem[]>;
  approveDraftFact(input: {
    factId: string;
    reviewedBy: string;
    expectedVersion: number;
  }): Promise<PoiFact | null>;
  renewFact(input: {
    factId: string;
    reviewedBy: string;
    expiresAt?: string | null;
  }): Promise<PoiFact | null>;
  deprecateFact(input: { factId: string }): Promise<PoiFact | null>;
  rejectFact(input: { factId: string; rejectedBy: string }): Promise<PoiFact | null>;
  recordGap(input: { question: string; city?: string }): Promise<KnowledgeGap>;
  recordEvidenceGap(input: {
    question: string;
    city: string;
    actorId: string;
    taskId: string;
    evidenceId: string;
  }): Promise<KnowledgeGap>;
  listGaps(input?: { status?: KnowledgeGap["status"] }): Promise<KnowledgeGap[]>;
  updateGap(input: {
    gapId: string;
    status: KnowledgeGap["status"];
    resolutionTarget?: KnowledgeGap["resolutionTarget"];
  }): Promise<KnowledgeGap | null>;
};

export function createInMemoryKnowledgeService(
  seed: Poi[] = INITIAL_POIS,
  seedGaps: KnowledgeGap[] = INITIAL_KNOWLEDGE_GAPS,
  seedScopedFacts: ScopedExecutionFact[] = [],
): KnowledgeService {
  let pois = seed;
  let gaps = seedGaps.map((gap) => KnowledgeGapSchema.parse(gap));
  let scopedFacts = seedScopedFacts.map((fact) => ScopedExecutionFactSchema.parse(fact));

  return {
    async listPois(input = {}) {
      return pois
        .filter((poi) => !input.city || poi.city === input.city)
        .filter((poi) => !input.category || poi.category === input.category)
        .map((poi) =>
          PoiSchema.parse({
            ...poi,
            facts: poi.facts.filter((fact) => {
              if (isEligiblePoiFact(fact)) return true;
              if (input.includeDrafts && fact.status === "draft") return true;
              if (input.includeDeprecated && fact.status === "deprecated") return true;
              return input.includeExpired && isExpired(fact);
            }),
            commercialLinks: poi.commercialLinks.filter((link) => link.url.length > 0),
          }),
        );
    },
    async createPoi(input) {
      const { actorId: _actorId, ...candidate } = input;
      const parsed = PoiCreateInputSchema.parse(candidate);
      const poi = PoiSchema.parse({
        id: crypto.randomUUID(),
        city: parsed.city,
        category: parsed.category,
        nameEn: parsed.nameEn,
        ...(parsed.nameZh === null ? {} : { nameZh: parsed.nameZh }),
        ...(parsed.latitude === null ? {} : { latitude: parsed.latitude }),
        ...(parsed.longitude === null ? {} : { longitude: parsed.longitude }),
        sourceIds: {},
        facts: [],
        commercialLinks: [],
      });
      pois = [...pois, poi];
      return poi;
    },
    async updatePoi(input) {
      const { actorId: _actorId, ...candidate } = input;
      const parsed = PoiUpdateInputSchema.parse(candidate);
      const existing = pois.find((poi) => poi.id === parsed.id);
      if (!existing) return null;
      const {
        latitude: _latitude,
        longitude: _longitude,
        nameZh: _nameZh,
        ...preserved
      } = existing;
      const updated = PoiSchema.parse({
        ...preserved,
        city: parsed.city,
        category: parsed.category,
        nameEn: parsed.nameEn,
        ...(parsed.nameZh === null ? {} : { nameZh: parsed.nameZh }),
        ...(parsed.latitude === null ? {} : { latitude: parsed.latitude }),
        ...(parsed.longitude === null ? {} : { longitude: parsed.longitude }),
      });
      pois = pois.map((poi) => (poi.id === parsed.id ? updated : poi));
      return updated;
    },
    async createFact(input) {
      const value = parsePoiFactWriteValue(input.factType, input.value);
      assertWritableFact({ ...input, value });
      const evidence = PoiFactEvidenceSchema.parse(input);
      const poi = pois.find((candidate) => candidate.id === input.poiId);
      if (!poi) throw new Error("POI not found");
      const ingestedAt = new Date().toISOString();
      const fact: PoiFact = {
        id: crypto.randomUUID(),
        poiId: input.poiId,
        factType: input.factType,
        value,
        confidence: input.confidence,
        source: evidence.sourceLocator,
        ...evidence,
        ingestedAt,
        verifiedAt: null,
        expiresAt: input.expiresAt ?? null,
        reviewPolicy: null,
        version: 1,
        status: "draft",
      };
      pois = pois.map((candidate) =>
        candidate.id === input.poiId
          ? { ...candidate, facts: [...candidate.facts, fact] }
          : candidate,
      );
      return fact;
    },
    async updateFact(input) {
      const existing = findFact(pois, input.factId);
      if (!existing) throw new Error("Fact not found");
      const value = parsePoiFactWriteValue(existing.factType, input.value);
      const evidence = PoiFactEvidenceSchema.parse({
        sourceClass: input.sourceClass ?? existing.sourceClass,
        sourceLocator: input.sourceLocator ?? existing.sourceLocator,
        evidenceSummary: input.evidenceSummary ?? existing.evidenceSummary,
      });
      assertWritableFact({
        value,
        confidence: input.confidence ?? existing.confidence,
        ...evidence,
      });
      pois = updatePoiFact(pois, input.factId, value, {
        ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
        source: evidence.sourceLocator,
        ...evidence,
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        status: "draft",
        verifiedAt: null,
        reviewPolicy: null,
      });
      return this.listPois({ includeDrafts: true, includeExpired: true, includeDeprecated: true });
    },
    async createScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      const target = input.target;
      if (target.scope === "poi" && !pois.some((poi) => poi.id === target.poiId)) {
        throw new Error("POI not found");
      }
      const value = parsePoiFactWriteValue(input.factType, input.value);
      assertWritableFact({ ...input, value });
      const evidence = PoiFactEvidenceSchema.parse(input);
      const fact = ScopedExecutionFactSchema.parse({
        id: crypto.randomUUID(),
        target,
        factType: input.factType,
        value,
        confidence: input.confidence,
        source: evidence.sourceLocator,
        ...evidence,
        ingestedAt: new Date().toISOString(),
        verifiedAt: null,
        expiresAt: input.expiresAt ?? null,
        reviewPolicy: null,
        version: 1,
        status: "draft",
      });
      scopedFacts = [...scopedFacts, fact];
      return fact;
    },
    async updateScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      const index = scopedFacts.findIndex((fact) => fact.id === input.factId);
      if (index < 0) return { status: "not_found" };
      const existing = scopedFacts[index] as ScopedExecutionFact;
      const version = resolveExecutionFactVersion({
        expectedVersion: input.expectedVersion,
        currentVersion: existing.version,
      });
      if (version.status === "conflict") return version;
      const evidence = PoiFactEvidenceSchema.parse({
        sourceClass: input.sourceClass ?? existing.sourceClass,
        sourceLocator: input.sourceLocator ?? existing.sourceLocator,
        evidenceSummary: input.evidenceSummary ?? existing.evidenceSummary,
      });
      const value = parsePoiFactWriteValue(existing.factType, input.value);
      assertWritableFact({
        value,
        confidence: input.confidence ?? existing.confidence,
        ...evidence,
      });
      const updated = ScopedExecutionFactSchema.parse({
        ...existing,
        value,
        confidence: input.confidence ?? existing.confidence,
        source: evidence.sourceLocator,
        ...evidence,
        expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
        verifiedAt: null,
        reviewPolicy: null,
        version: existing.version + 1,
        status: "draft",
      });
      scopedFacts = scopedFacts.map((fact, candidateIndex) =>
        candidateIndex === index ? updated : fact,
      );
      return { status: "updated", fact: updated };
    },
    async reviewScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      const index = scopedFacts.findIndex((fact) => fact.id === input.factId);
      if (index < 0) return { status: "not_found" };
      const existing = scopedFacts[index] as ScopedExecutionFact;
      const version = resolveExecutionFactVersion({
        expectedVersion: input.expectedVersion,
        currentVersion: existing.version,
      });
      if (version.status === "conflict") return version;
      if (existing.status !== "draft" || !hasReviewablePoiFactEvidence(existing)) {
        return {
          status: "conflict",
          reason: "not_reviewable",
          expectedVersion: input.expectedVersion,
          currentVersion: existing.version,
        };
      }
      const verifiedAt = new Date();
      const review = resolvePoiFactReview({ factType: existing.factType, verifiedAt });
      const reviewed = ScopedExecutionFactSchema.parse({
        ...existing,
        verifiedAt: verifiedAt.toISOString(),
        expiresAt: review.expiresAt,
        reviewPolicy: review.reviewPolicy,
        version: existing.version + 1,
        status: "reviewed",
      });
      scopedFacts = scopedFacts.map((fact, candidateIndex) =>
        candidateIndex === index ? reviewed : fact,
      );
      return { status: "updated", fact: reviewed };
    },
    async deprecateScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      const index = scopedFacts.findIndex((fact) => fact.id === input.factId);
      if (index < 0) return { status: "not_found" };
      const existing = scopedFacts[index] as ScopedExecutionFact;
      const version = resolveExecutionFactVersion({
        expectedVersion: input.expectedVersion,
        currentVersion: existing.version,
      });
      if (version.status === "conflict") return version;
      const deprecated = ScopedExecutionFactSchema.parse({
        ...existing,
        version: existing.version + 1,
        status: "deprecated",
      });
      scopedFacts = scopedFacts.map((fact, candidateIndex) =>
        candidateIndex === index ? deprecated : fact,
      );
      return { status: "updated", fact: deprecated };
    },
    async retrieveScopedFacts(input) {
      return resolveScopedFactRetrieval(scopedFacts, input);
    },
    async listExpiredFacts(input = {}) {
      const now = input.now ?? new Date();
      return pois.flatMap((poi) =>
        poi.facts.filter(
          (fact) =>
            fact.status === "reviewed" &&
            fact.expiresAt &&
            Date.parse(fact.expiresAt) < now.getTime(),
        ),
      );
    },
    async listDraftFactReviewQueue(input = {}) {
      const filter = DraftFactReviewQueueFilterSchema.parse(input);
      return pois.flatMap((poi) => {
        if (filter.poiId && poi.id !== filter.poiId) return [];
        const reviewedSiblings = poi.facts.filter((fact) => fact.status === "reviewed");
        return poi.facts
          .filter((fact) => fact.status === "draft")
          .filter((fact) => !filter.factType || fact.factType === filter.factType)
          .filter(() => filter.importBatchId === undefined)
          .map((draft) =>
            DraftFactReviewQueueItemSchema.parse({
              poi: {
                id: poi.id,
                city: poi.city,
                category: poi.category,
                nameEn: poi.nameEn,
                ...(poi.nameZh ? { nameZh: poi.nameZh } : {}),
              },
              draft,
              importContext: null,
              reviewedSiblings,
            }),
          );
      });
    },
    async renewFact(input) {
      const existing = findFact(pois, input.factId);
      if (!existing) return null;
      if (existing.status !== "reviewed") {
        throw new Error("Only reviewed facts can be renewed");
      }
      if (!hasReviewablePoiFactEvidence(existing)) {
        throw new Error("Fact requires independently reviewable evidence before review");
      }
      const verifiedAt = new Date();
      const review = resolvePoiFactReview({
        factType: existing.factType,
        verifiedAt,
        ...(input.expiresAt !== undefined ? { requestedExpiresAt: input.expiresAt } : {}),
      });
      pois = updatePoiFact(pois, input.factId, existing.value, {
        expiresAt: review.expiresAt,
        reviewPolicy: review.reviewPolicy,
        status: "reviewed",
        verifiedAt: verifiedAt.toISOString(),
      });
      return findFact(pois, input.factId);
    },
    async approveDraftFact(input) {
      const existing = findFact(pois, input.factId);
      if (!existing) return null;
      if (existing.status !== "draft" || existing.version !== input.expectedVersion) {
        throw new Error("Fact is no longer the unreviewed draft shown for confirmation");
      }
      if (!hasReviewablePoiFactEvidence(existing)) {
        throw new Error("Fact requires independently reviewable evidence before review");
      }
      const verifiedAt = new Date();
      const review = resolvePoiFactReview({ factType: existing.factType, verifiedAt });
      pois = updatePoiFact(pois, input.factId, existing.value, {
        expiresAt: review.expiresAt,
        reviewPolicy: review.reviewPolicy,
        status: "reviewed",
        verifiedAt: verifiedAt.toISOString(),
      });
      return findFact(pois, input.factId);
    },
    async deprecateFact(input) {
      const existing = findFact(pois, input.factId);
      if (!existing) return null;
      pois = updatePoiFact(pois, input.factId, existing.value, { status: "deprecated" });
      return findFact(pois, input.factId);
    },
    async rejectFact(input) {
      const existing = findFact(pois, input.factId);
      if (!existing) return null;
      if (existing.status !== "draft") {
        throw new Error("Only draft facts can be rejected through the review queue");
      }
      pois = updatePoiFact(pois, input.factId, existing.value, { status: "rejected" });
      return findFact(pois, input.factId);
    },
    async recordGap(input) {
      const questionPattern = normalizeGapPattern(input.question);
      const existing = gaps.find(
        (gap) => gap.questionPattern === questionPattern && (gap.city ?? "") === (input.city ?? ""),
      );
      if (existing) {
        gaps = gaps.map((gap) =>
          gap.id === existing.id ? { ...gap, frequency: gap.frequency + 1 } : gap,
        );
        return gaps.find((gap) => gap.id === existing.id) as KnowledgeGap;
      }
      const gap = KnowledgeGapSchema.parse({
        id: crypto.randomUUID(),
        questionPattern,
        frequency: 1,
        ...(input.city ? { city: input.city } : {}),
        status: "open",
      });
      gaps = [gap, ...gaps];
      return gap;
    },
    async recordEvidenceGap(input) {
      return this.recordGap({
        question: sanitizeEvidenceDerivedGapPattern(input.question),
        city: input.city,
      });
    },
    async listGaps(input = {}) {
      return gaps
        .filter((gap) => !input.status || gap.status === input.status)
        .sort((a, b) => b.frequency - a.frequency);
    },
    async updateGap(input) {
      let updated: KnowledgeGap | null = null;
      gaps = gaps.map((gap) => {
        if (gap.id !== input.gapId) return gap;
        updated = KnowledgeGapSchema.parse({
          ...gap,
          status: input.status,
          ...(input.status === "resolved" ? { resolvedAt: new Date().toISOString() } : {}),
          ...(input.resolutionTarget ? { resolutionTarget: input.resolutionTarget } : {}),
        });
        return updated;
      });
      return updated;
    },
  };
}

export function resolveScopedFactRetrieval(
  facts: ScopedExecutionFact[],
  input: {
    context: ExecutionFactRetrievalContext;
    factTypes: string[];
    now?: Date;
  },
): ScopedFactRetrievalResult {
  const resolved = resolveScopedFactRetrievalInput(input);
  const { factTypes, now, targets } = resolved;

  const eligible = facts.filter((fact) => isEligibleScopedExecutionFact(fact, now));
  const resolvedTypes = new Set<string>();
  const blockedTypes = new Set<string>();
  const result: ScopedFactRetrievalResult = { facts: [], ambiguities: [] };

  for (const target of targets) {
    const targetKey = executionFactTargetKey(target);
    const groups = new Map<string, ScopedExecutionFact[]>();
    for (const fact of eligible) {
      if (executionFactTargetKey(fact.target) !== targetKey) continue;
      if (factTypes.length > 0 && !factTypes.includes(fact.factType)) continue;
      if (resolvedTypes.has(fact.factType) || blockedTypes.has(fact.factType)) continue;
      const candidates = groups.get(fact.factType) ?? [];
      candidates.push(fact);
      groups.set(fact.factType, candidates);
    }

    for (const [factType, candidates] of [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const ordered = [...candidates].sort((left, right) => left.id.localeCompare(right.id));
      if (ordered.length === 1) {
        result.facts.push(ordered[0] as ScopedExecutionFact);
        resolvedTypes.add(factType);
      } else {
        result.ambiguities.push({
          target,
          factType,
          factIds: ordered.map((fact) => fact.id),
        });
        blockedTypes.add(factType);
      }
    }
  }

  return result;
}

export function resolveScopedFactRetrievalInput(input: {
  context: ExecutionFactRetrievalContext;
  factTypes: string[];
  now?: Date;
}): ResolvedScopedFactRetrievalInput {
  const factTypes = input.factTypes.map((factType) => factType.trim());
  if (
    factTypes.length === 0 ||
    factTypes.length > 20 ||
    factTypes.some((factType) => factType.length === 0 || factType.length > 120) ||
    new Set(factTypes).size !== factTypes.length
  ) {
    throw new Error("Scoped fact types must contain 1-20 unique non-empty values");
  }
  return {
    targets: deriveExecutionFactTargetOrder(input.context),
    factTypes,
    now: input.now ?? new Date(),
  };
}

export function requireKnowledgePermission(
  actor: OpsAccess,
  permission: "knowledge.read" | "knowledge.write",
): void {
  if (!actor.permissions.includes(permission)) {
    throw new Error("Forbidden Ops permission");
  }
}

function findFact(pois: Poi[], factId: string): PoiFact | null {
  return pois.flatMap((poi) => poi.facts).find((fact) => fact.id === factId) ?? null;
}

export function assertWritableFact(input: {
  value: Record<string, unknown>;
  confidence: number;
  sourceClass: PoiFactSourceClass;
  sourceLocator: string;
  evidenceSummary: string;
}) {
  if (Object.keys(input.value).length === 0) throw new Error("Fact value is required");
  if (input.confidence < 0 || input.confidence > 1) throw new Error("Fact confidence is invalid");
  PoiFactEvidenceSchema.parse(input);
}

function normalizeGapPattern(question: string): string {
  return question
    .toLowerCase()
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/g, " private email ")
    .replace(/\b(?:\+?\d[\d\s()-]{6,}\d)\b/g, " private number ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExpired(fact: { expiresAt: string | null }): boolean {
  return fact.expiresAt !== null && Date.parse(fact.expiresAt) < Date.now();
}
