import {
  KnowledgeGapSchema,
  hasReviewablePoiFactEvidence,
  isEligiblePoiFact,
  PoiFactEvidenceSchema,
  PoiFactSchema,
  PoiSchema,
  resolvePoiFactReview,
  type KnowledgeGap,
  type Poi,
  type PoiCategory,
  type PoiFact,
} from "@visepanda/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { knowledgeGaps, opsAuditEvents, poiCommercialLinks, poiFacts, pois } from "./schema.js";
import type { KnowledgeService } from "../modules/knowledge/service.js";

export function createDbKnowledgeService(db: Db): KnowledgeService {
  return {
    async listPois(input = {}) {
      return listPois(db, input);
    },
    async createFact(input) {
      const evidence = PoiFactEvidenceSchema.parse(input);
      const [row] = await db
        .insert(poiFacts)
        .values({
          poiId: input.poiId,
          factType: input.factType,
          valueJsonb: input.value,
          confidence: String(input.confidence),
          source: evidence.sourceLocator,
          sourceClass: evidence.sourceClass,
          sourceLocator: evidence.sourceLocator,
          evidenceSummary: evidence.evidenceSummary,
          verifiedAt: null,
          reviewPolicy: null,
          reviewedBy: null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          status: "draft",
        })
        .returning();
      if (!row) throw new Error("Fact insert failed");
      return rowToFact(row);
    },
    async updateFact(input) {
      const existing = await getFact(db, input.factId);
      if (!existing) throw new Error("Fact not found");
      const evidence = PoiFactEvidenceSchema.parse({
        sourceClass: input.sourceClass ?? existing.sourceClass,
        sourceLocator: input.sourceLocator ?? existing.sourceLocator,
        evidenceSummary: input.evidenceSummary ?? existing.evidenceSummary,
      });
      await db
        .update(poiFacts)
        .set({
          valueJsonb: input.value,
          confidence: String(input.confidence ?? existing.confidence),
          source: evidence.sourceLocator,
          sourceClass: evidence.sourceClass,
          sourceLocator: evidence.sourceLocator,
          evidenceSummary: evidence.evidenceSummary,
          verifiedAt: null,
          reviewPolicy: null,
          reviewedBy: null,
          expiresAt:
            input.expiresAt === undefined
              ? existing.expiresAt
                ? new Date(existing.expiresAt)
                : null
              : input.expiresAt
                ? new Date(input.expiresAt)
                : null,
          version: existing.version + 1,
          status: "draft",
        })
        .where(eq(poiFacts.id, input.factId));
      return listPois(db, {
        includeDrafts: true,
        includeExpired: true,
        includeDeprecated: true,
      });
    },
    async listExpiredFacts(input = {}) {
      const all = await listPois(db, { includeExpired: true });
      const now = input.now ?? new Date();
      return all.flatMap((poi) =>
        poi.facts.filter(
          (fact) =>
            fact.status === "reviewed" &&
            fact.expiresAt !== null &&
            Date.parse(fact.expiresAt) < now.getTime(),
        ),
      );
    },
    async renewFact(input) {
      const existing = await getFact(db, input.factId);
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
      const row = await db.transaction(async (transaction) => {
        const [reviewed] = await transaction
          .update(poiFacts)
          .set({
            expiresAt: new Date(review.expiresAt),
            reviewPolicy: review.reviewPolicy,
            reviewedBy: input.reviewedBy,
            status: "reviewed",
            verifiedAt,
            version: existing.version + 1,
          })
          .where(eq(poiFacts.id, input.factId))
          .returning();
        if (!reviewed) return null;
        await transaction.insert(opsAuditEvents).values({
          actorId: input.reviewedBy,
          action: "knowledge.fact.review.completed",
          targetType: "poi_fact",
          targetId: input.factId,
          metadataJsonb: { reviewPolicy: review.reviewPolicy, version: reviewed.version },
        });
        return reviewed;
      });
      return row ? rowToFact(row) : null;
    },
    async deprecateFact(input) {
      const existing = await getFact(db, input.factId);
      if (!existing) return null;
      const [row] = await db
        .update(poiFacts)
        .set({ status: "deprecated", version: existing.version + 1 })
        .where(eq(poiFacts.id, input.factId))
        .returning();
      return row ? rowToFact(row) : null;
    },
    async recordGap(input) {
      const questionPattern = normalizeGapPattern(input.question);
      const rows = await db.select().from(knowledgeGaps);
      const existing = rows.find(
        (gap) => gap.questionPattern === questionPattern && (gap.city ?? "") === (input.city ?? ""),
      );
      if (existing) {
        const [row] = await db
          .update(knowledgeGaps)
          .set({ frequency: existing.frequency + 1, updatedAt: new Date() })
          .where(eq(knowledgeGaps.id, existing.id))
          .returning();
        if (!row) throw new Error("Gap update failed");
        return rowToGap(row);
      }

      const [row] = await db
        .insert(knowledgeGaps)
        .values({
          questionPattern,
          city: input.city,
          status: "open",
        })
        .returning();
      if (!row) throw new Error("Gap insert failed");
      return rowToGap(row);
    },
    async recordEvidenceGap(input) {
      const questionPattern = normalizeGapPattern(input.question);
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(knowledgeGaps);
        const existing = rows.find(
          (gap) => gap.questionPattern === questionPattern && (gap.city ?? "") === input.city,
        );
        const [row] = existing
          ? await tx
              .update(knowledgeGaps)
              .set({ frequency: existing.frequency + 1, updatedAt: new Date() })
              .where(eq(knowledgeGaps.id, existing.id))
              .returning()
          : await tx
              .insert(knowledgeGaps)
              .values({ questionPattern, city: input.city, status: "open" })
              .returning();
        if (!row) throw new Error("Evidence gap write failed");
        await tx.insert(opsAuditEvents).values({
          actorId: input.actorId,
          action: "human_task.evidence.gap.proposed",
          targetType: "knowledge_gap",
          targetId: row.id,
          metadataJsonb: { taskId: input.taskId, evidenceId: input.evidenceId },
        });
        return rowToGap(row);
      });
    },
    async listGaps(input = {}) {
      const rows = await db.select().from(knowledgeGaps);
      return rows
        .map(rowToGap)
        .filter((gap) => !input.status || gap.status === input.status)
        .sort((a, b) => b.frequency - a.frequency);
    },
    async updateGap(input) {
      const [row] = await db
        .update(knowledgeGaps)
        .set({
          status: input.status,
          updatedAt: new Date(),
          resolvedAt: input.status === "resolved" ? new Date() : null,
          resolutionTargetJsonb: input.resolutionTarget ?? null,
        })
        .where(eq(knowledgeGaps.id, input.gapId))
        .returning();
      return row ? rowToGap(row) : null;
    },
  };
}

async function listPois(
  db: Db,
  input: {
    city?: string;
    category?: PoiCategory;
    includeExpired?: boolean;
    includeDeprecated?: boolean;
    includeDrafts?: boolean;
  } = {},
): Promise<Poi[]> {
  const where = [
    input.city ? eq(pois.city, input.city) : undefined,
    input.category ? eq(pois.category, input.category) : undefined,
  ].filter(Boolean);
  const poiRows = await db
    .select()
    .from(pois)
    .where(where.length ? and(...where) : undefined);
  const factRows = await db.select().from(poiFacts);
  const linkRows = await db.select().from(poiCommercialLinks);

  return poiRows.map((poi) =>
    PoiSchema.parse({
      id: poi.id,
      city: poi.city,
      category: poi.category,
      nameEn: poi.nameEn,
      ...(poi.nameZh ? { nameZh: poi.nameZh } : {}),
      ...(poi.address ? { address: poi.address } : {}),
      ...(poi.latitude ? { latitude: Number(poi.latitude) } : {}),
      ...(poi.longitude ? { longitude: Number(poi.longitude) } : {}),
      sourceIds: poi.sourceIds,
      facts: factRows
        .filter((fact) => fact.poiId === poi.id)
        .map(rowToFact)
        .filter((fact) => {
          if (isEligiblePoiFact(fact)) return true;
          if (input.includeDrafts && fact.status === "draft") return true;
          if (input.includeDeprecated && fact.status === "deprecated") return true;
          return input.includeExpired && isExpired(fact);
        }),
      commercialLinks: linkRows
        .filter((link) => link.poiId === poi.id && link.status === "active")
        .map((link) => ({
          id: link.id,
          poiId: link.poiId,
          partner: link.partner,
          url: link.url,
          disclosure: link.disclosure,
        })),
    }),
  );
}

async function getFact(db: Db, id: string): Promise<PoiFact | null> {
  const [row] = await db.select().from(poiFacts).where(eq(poiFacts.id, id)).limit(1);
  return row ? rowToFact(row) : null;
}

function rowToFact(row: typeof poiFacts.$inferSelect): PoiFact {
  return PoiFactSchema.parse({
    id: row.id,
    poiId: row.poiId,
    factType: row.factType,
    value: row.valueJsonb,
    confidence: Number(row.confidence),
    source: row.source,
    sourceClass: row.sourceClass,
    sourceLocator: row.sourceLocator,
    evidenceSummary: row.evidenceSummary,
    ingestedAt: row.createdAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    reviewPolicy: row.reviewPolicy,
    version: row.version,
    status: row.status,
  });
}

function rowToGap(row: typeof knowledgeGaps.$inferSelect): KnowledgeGap {
  return KnowledgeGapSchema.parse({
    id: row.id,
    questionPattern: row.questionPattern,
    frequency: row.frequency,
    ...(row.city ? { city: row.city } : {}),
    status: row.status,
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.toISOString() } : {}),
    ...(row.resolutionTargetJsonb ? { resolutionTarget: row.resolutionTargetJsonb } : {}),
  });
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
