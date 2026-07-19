import {
  INITIAL_KNOWLEDGE_GAPS,
  INITIAL_POIS,
  hasReviewablePoiFactEvidence,
  isEligiblePoiFact,
  KnowledgeGapSchema,
  PoiFactEvidenceSchema,
  PoiSchema,
  sanitizeEvidenceDerivedGapPattern,
  resolvePoiFactReview,
  updatePoiFact,
  type KnowledgeGap,
  type Poi,
  type PoiCategory,
  type PoiFact,
  type PoiFactSourceClass,
} from "@visepanda/domain";

export type KnowledgeService = {
  listPois(input?: {
    city?: string;
    category?: PoiCategory;
    includeExpired?: boolean;
    includeDeprecated?: boolean;
    includeDrafts?: boolean;
  }): Promise<Poi[]>;
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
  listExpiredFacts(input?: { now?: Date }): Promise<PoiFact[]>;
  renewFact(input: {
    factId: string;
    reviewedBy: string;
    expiresAt?: string | null;
  }): Promise<PoiFact | null>;
  deprecateFact(input: { factId: string }): Promise<PoiFact | null>;
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
): KnowledgeService {
  let pois = seed;
  let gaps = seedGaps.map((gap) => KnowledgeGapSchema.parse(gap));

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
    async createFact(input) {
      assertWritableFact(input);
      const evidence = PoiFactEvidenceSchema.parse(input);
      const poi = pois.find((candidate) => candidate.id === input.poiId);
      if (!poi) throw new Error("POI not found");
      const ingestedAt = new Date().toISOString();
      const fact: PoiFact = {
        id: crypto.randomUUID(),
        poiId: input.poiId,
        factType: input.factType,
        value: input.value,
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
      const evidence = PoiFactEvidenceSchema.parse({
        sourceClass: input.sourceClass ?? existing.sourceClass,
        sourceLocator: input.sourceLocator ?? existing.sourceLocator,
        evidenceSummary: input.evidenceSummary ?? existing.evidenceSummary,
      });
      assertWritableFact({
        value: input.value,
        confidence: input.confidence ?? existing.confidence,
        ...evidence,
      });
      pois = updatePoiFact(pois, input.factId, input.value, {
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
    async renewFact(input) {
      const existing = findFact(pois, input.factId);
      if (!existing) return null;
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
    async deprecateFact(input) {
      const existing = findFact(pois, input.factId);
      if (!existing) return null;
      pois = updatePoiFact(pois, input.factId, existing.value, { status: "deprecated" });
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

function findFact(pois: Poi[], factId: string): PoiFact | null {
  return pois.flatMap((poi) => poi.facts).find((fact) => fact.id === factId) ?? null;
}

function assertWritableFact(input: {
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
