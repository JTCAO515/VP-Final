import {
  KnowledgeGapSchema,
  DraftFactReviewQueueFilterSchema,
  DraftFactReviewQueueItemSchema,
  sanitizeEvidenceDerivedGapPattern,
  hasReviewablePoiFactEvidence,
  isEligiblePoiFact,
  parsePoiFactWriteValue,
  PoiCreateInputSchema,
  PoiFactEvidenceSchema,
  PoiFactSchema,
  PoiSchema,
  ScopedExecutionFactSchema,
  ExecutionFactTargetSchema,
  PoiUpdateInputSchema,
  resolveExecutionFactVersion,
  resolvePoiFactReview,
  type KnowledgeGap,
  type DraftFactReviewQueueFilter,
  type DraftFactReviewQueueItem,
  type Poi,
  type PoiCategory,
  type PoiFact,
  type ExecutionFactTarget,
  type ScopedExecutionFact,
} from "@visepanda/domain";
import { and, eq, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  knowledgeGaps,
  opsAuditEvents,
  poiCommercialLinks,
  poiFactEditorialAudit,
  poiFacts,
  pois,
  scopedExecutionFacts,
} from "./schema.js";
import {
  requireKnowledgePermission,
  resolveScopedFactRetrieval,
  resolveScopedFactRetrievalInput,
  assertWritableFact,
  type KnowledgeService,
  type ScopedFactWriteResult,
} from "../modules/knowledge/service.js";

export function createDbKnowledgeService(db: Db): KnowledgeService {
  return {
    async listPois(input = {}) {
      return listPois(db, input);
    },
    async createPoi(input) {
      const { actorId, ...candidate } = input;
      const parsed = PoiCreateInputSchema.parse(candidate);
      const row = await db.transaction(async (transaction) => {
        const [created] = await transaction
          .insert(pois)
          .values({
            city: parsed.city,
            category: parsed.category,
            nameEn: parsed.nameEn,
            nameZh: parsed.nameZh,
            latitude: parsed.latitude === null ? null : String(parsed.latitude),
            longitude: parsed.longitude === null ? null : String(parsed.longitude),
            sourceIds: {},
          })
          .returning();
        if (!created) throw new Error("POI insert failed");
        await transaction.insert(opsAuditEvents).values({
          actorId,
          action: "knowledge.poi.create.completed",
          targetType: "poi",
          targetId: created.id,
          metadataJsonb: { fields: POI_WRITABLE_FIELD_NAMES },
        });
        return created;
      });
      return rowToPoi(row);
    },
    async updatePoi(input) {
      const { actorId, ...candidate } = input;
      const parsed = PoiUpdateInputSchema.parse(candidate);
      const row = await db.transaction(async (transaction) => {
        const [updated] = await transaction
          .update(pois)
          .set({
            city: parsed.city,
            category: parsed.category,
            nameEn: parsed.nameEn,
            nameZh: parsed.nameZh,
            latitude: parsed.latitude === null ? null : String(parsed.latitude),
            longitude: parsed.longitude === null ? null : String(parsed.longitude),
            updatedAt: new Date(),
          })
          .where(eq(pois.id, parsed.id))
          .returning();
        if (!updated) return null;
        await transaction.insert(opsAuditEvents).values({
          actorId,
          action: "knowledge.poi.update.completed",
          targetType: "poi",
          targetId: updated.id,
          metadataJsonb: { fields: POI_WRITABLE_FIELD_NAMES },
        });
        return updated;
      });
      return row ? rowToPoi(row) : null;
    },
    async createFact(input) {
      const evidence = PoiFactEvidenceSchema.parse(input);
      const value = parsePoiFactWriteValue(input.factType, input.value);
      const [row] = await db
        .insert(poiFacts)
        .values({
          poiId: input.poiId,
          factType: input.factType,
          valueJsonb: value,
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
      const value = parsePoiFactWriteValue(existing.factType, input.value);
      const evidence = PoiFactEvidenceSchema.parse({
        sourceClass: input.sourceClass ?? existing.sourceClass,
        sourceLocator: input.sourceLocator ?? existing.sourceLocator,
        evidenceSummary: input.evidenceSummary ?? existing.evidenceSummary,
      });
      await db
        .update(poiFacts)
        .set({
          valueJsonb: value,
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
    async createScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      const evidence = PoiFactEvidenceSchema.parse(input);
      const value = parsePoiFactWriteValue(input.factType, input.value);
      assertWritableFact({ ...input, value });
      const candidate = ScopedExecutionFactSchema.parse({
        id: crypto.randomUUID(),
        target: input.target,
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
      const row = await db.transaction(async (transaction) => {
        const [created] = await transaction
          .insert(scopedExecutionFacts)
          .values(scopedFactInsertValues(candidate))
          .returning();
        if (!created) throw new Error("Scoped fact insert failed");
        await transaction.insert(opsAuditEvents).values({
          actorId: input.actor.userId,
          action: "knowledge.scoped_fact.create.completed",
          targetType: "scoped_execution_fact",
          targetId: created.id,
          metadataJsonb: {
            scope: candidate.target.scope,
            factType: candidate.factType,
            version: created.version,
          },
        });
        return created;
      });
      return rowToScopedFact(row);
    },
    async updateScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .select()
          .from(scopedExecutionFacts)
          .where(eq(scopedExecutionFacts.id, input.factId))
          .limit(1);
        if (!row) return { status: "not_found" } as const;
        const existing = rowToScopedFact(row);
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
        const candidate = ScopedExecutionFactSchema.parse({
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
        const [updated] = await transaction
          .update(scopedExecutionFacts)
          .set({
            valueJsonb: candidate.value,
            confidence: String(candidate.confidence),
            source: candidate.source,
            sourceClass: candidate.sourceClass,
            sourceLocator: candidate.sourceLocator,
            evidenceSummary: candidate.evidenceSummary,
            verifiedAt: null,
            expiresAt: candidate.expiresAt ? new Date(candidate.expiresAt) : null,
            reviewPolicy: null,
            reviewedBy: null,
            version: candidate.version,
            status: "draft",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(scopedExecutionFacts.id, input.factId),
              eq(scopedExecutionFacts.version, input.expectedVersion),
            ),
          )
          .returning();
        if (!updated)
          return scopedConflictAfterRace(transaction, input.factId, input.expectedVersion);
        await transaction.insert(opsAuditEvents).values({
          actorId: input.actor.userId,
          action: "knowledge.scoped_fact.update.completed",
          targetType: "scoped_execution_fact",
          targetId: updated.id,
          metadataJsonb: { fields: ["value", "evidence"], version: updated.version },
        });
        return { status: "updated", fact: rowToScopedFact(updated) } as const;
      });
    },
    async reviewScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .select()
          .from(scopedExecutionFacts)
          .where(eq(scopedExecutionFacts.id, input.factId))
          .limit(1);
        if (!row) return { status: "not_found" } as const;
        const existing = rowToScopedFact(row);
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
          } as const;
        }
        const verifiedAt = new Date();
        const review = resolvePoiFactReview({ factType: existing.factType, verifiedAt });
        const [reviewed] = await transaction
          .update(scopedExecutionFacts)
          .set({
            verifiedAt,
            expiresAt: new Date(review.expiresAt),
            reviewPolicy: review.reviewPolicy,
            reviewedBy: input.actor.userId,
            version: existing.version + 1,
            status: "reviewed",
            updatedAt: verifiedAt,
          })
          .where(
            and(
              eq(scopedExecutionFacts.id, input.factId),
              eq(scopedExecutionFacts.status, "draft"),
              eq(scopedExecutionFacts.version, input.expectedVersion),
            ),
          )
          .returning();
        if (!reviewed)
          return scopedConflictAfterRace(transaction, input.factId, input.expectedVersion);
        await transaction.insert(opsAuditEvents).values({
          actorId: input.actor.userId,
          action: "knowledge.scoped_fact.review.completed",
          targetType: "scoped_execution_fact",
          targetId: reviewed.id,
          metadataJsonb: { reviewPolicy: review.reviewPolicy, version: reviewed.version },
        });
        return { status: "updated", fact: rowToScopedFact(reviewed) } as const;
      });
    },
    async deprecateScopedFact(input) {
      requireKnowledgePermission(input.actor, "knowledge.write");
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .select()
          .from(scopedExecutionFacts)
          .where(eq(scopedExecutionFacts.id, input.factId))
          .limit(1);
        if (!row) return { status: "not_found" } as const;
        const existing = rowToScopedFact(row);
        const version = resolveExecutionFactVersion({
          expectedVersion: input.expectedVersion,
          currentVersion: existing.version,
        });
        if (version.status === "conflict") return version;
        const [deprecated] = await transaction
          .update(scopedExecutionFacts)
          .set({
            status: "deprecated",
            version: existing.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(scopedExecutionFacts.id, input.factId),
              eq(scopedExecutionFacts.version, input.expectedVersion),
            ),
          )
          .returning();
        if (!deprecated)
          return scopedConflictAfterRace(transaction, input.factId, input.expectedVersion);
        await transaction.insert(opsAuditEvents).values({
          actorId: input.actor.userId,
          action: "knowledge.scoped_fact.deprecate.completed",
          targetType: "scoped_execution_fact",
          targetId: deprecated.id,
          metadataJsonb: { version: deprecated.version },
        });
        return { status: "updated", fact: rowToScopedFact(deprecated) } as const;
      });
    },
    async retrieveScopedFacts(input) {
      const { factTypes, now, targets } = resolveScopedFactRetrievalInput(input);
      const targetConditions = targets.map((target) => scopedTargetCondition(target));
      const conditions = [
        eq(scopedExecutionFacts.status, "reviewed"),
        lte(scopedExecutionFacts.verifiedAt, now),
        gte(scopedExecutionFacts.expiresAt, now),
        or(...targetConditions),
        factTypes.length ? inArray(scopedExecutionFacts.factType, factTypes) : undefined,
      ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
      const rows = await db
        .select()
        .from(scopedExecutionFacts)
        .where(and(...conditions));
      return resolveScopedFactRetrieval(rows.map(rowToScopedFact), { ...input, now });
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
    async listDraftFactReviewQueue(input = {}) {
      return listDraftFactReviewQueue(db, input);
    },
    async renewFact(input) {
      return completeFactReview(db, {
        factId: input.factId,
        reviewedBy: input.reviewedBy,
        requiredStatus: "reviewed",
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      });
    },
    async approveDraftFact(input) {
      return completeFactReview(db, {
        factId: input.factId,
        reviewedBy: input.reviewedBy,
        requiredStatus: "draft",
        expectedVersion: input.expectedVersion,
      });
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
    async rejectFact(input) {
      const existing = await getFact(db, input.factId);
      if (!existing) return null;
      if (existing.status !== "draft") {
        throw new Error("Only draft facts can be rejected through the review queue");
      }
      return db.transaction(async (transaction) => {
        const [rejected] = await transaction
          .update(poiFacts)
          .set({ status: "rejected", version: existing.version + 1 })
          .where(
            and(
              eq(poiFacts.id, input.factId),
              eq(poiFacts.status, "draft"),
              eq(poiFacts.version, existing.version),
            ),
          )
          .returning();
        if (!rejected) {
          throw new Error("Fact is no longer an unreviewed draft");
        }
        await transaction.insert(opsAuditEvents).values({
          actorId: input.rejectedBy,
          action: "knowledge.fact.review.rejected",
          targetType: "poi_fact",
          targetId: input.factId,
          metadataJsonb: { version: rejected.version },
        });
        return rowToFact(rejected);
      });
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
      const questionPattern = sanitizeEvidenceDerivedGapPattern(input.question);
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

function scopedFactInsertValues(fact: ScopedExecutionFact) {
  const target = {
    poiId: null as string | null,
    city: null as string | null,
    sceneKey: null as string | null,
    countryCode: null as string | null,
  };
  switch (fact.target.scope) {
    case "poi":
      target.poiId = fact.target.poiId;
      break;
    case "city":
      target.city = fact.target.city;
      break;
    case "scene":
      target.sceneKey = fact.target.sceneKey;
      break;
    case "national":
      target.countryCode = fact.target.countryCode;
      break;
  }
  return {
    id: fact.id,
    scope: fact.target.scope,
    ...target,
    factType: fact.factType,
    valueJsonb: fact.value,
    confidence: String(fact.confidence),
    source: fact.source,
    sourceClass: fact.sourceClass,
    sourceLocator: fact.sourceLocator,
    evidenceSummary: fact.evidenceSummary,
    verifiedAt: fact.verifiedAt ? new Date(fact.verifiedAt) : null,
    expiresAt: fact.expiresAt ? new Date(fact.expiresAt) : null,
    reviewPolicy: fact.reviewPolicy,
    version: fact.version,
    status: fact.status,
  };
}

function scopedTargetCondition(target: ExecutionFactTarget) {
  switch (target.scope) {
    case "poi":
      return and(
        eq(scopedExecutionFacts.scope, "poi"),
        eq(scopedExecutionFacts.poiId, target.poiId),
      )!;
    case "city":
      return and(
        eq(scopedExecutionFacts.scope, "city"),
        eq(scopedExecutionFacts.city, target.city),
      )!;
    case "scene":
      return and(
        eq(scopedExecutionFacts.scope, "scene"),
        eq(scopedExecutionFacts.sceneKey, target.sceneKey),
      )!;
    case "national":
      return and(
        eq(scopedExecutionFacts.scope, "national"),
        eq(scopedExecutionFacts.countryCode, target.countryCode),
      )!;
  }
}

async function scopedConflictAfterRace(
  transaction: Parameters<Parameters<Db["transaction"]>[0]>[0],
  factId: string,
  expectedVersion: number,
): Promise<ScopedFactWriteResult> {
  const [current] = await transaction
    .select({ version: scopedExecutionFacts.version })
    .from(scopedExecutionFacts)
    .where(eq(scopedExecutionFacts.id, factId))
    .limit(1);
  return {
    status: "conflict",
    reason: current ? "stale_version" : "target_missing",
    expectedVersion,
    currentVersion: current?.version ?? null,
  };
}

function rowToScopedFact(row: typeof scopedExecutionFacts.$inferSelect): ScopedExecutionFact {
  const target = ExecutionFactTargetSchema.parse(
    (() => {
      switch (row.scope) {
        case "poi":
          return { scope: "poi", poiId: row.poiId ?? "" };
        case "city":
          return { scope: "city", city: row.city ?? "" };
        case "scene":
          return { scope: "scene", sceneKey: row.sceneKey ?? "" };
        case "national":
          return { scope: "national", countryCode: row.countryCode ?? "" };
        default:
          throw new Error("Scoped fact row has an unsupported target scope");
      }
    })(),
  );
  return ScopedExecutionFactSchema.parse({
    id: row.id,
    target,
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

const POI_WRITABLE_FIELD_NAMES = [
  "city",
  "category",
  "nameEn",
  "nameZh",
  "latitude",
  "longitude",
] as const;

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
      ...rowToPoi(poi),
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

async function listDraftFactReviewQueue(
  db: Db,
  input: DraftFactReviewQueueFilter = {},
): Promise<DraftFactReviewQueueItem[]> {
  const filter = DraftFactReviewQueueFilterSchema.parse(input);
  const conditions = [
    eq(poiFacts.status, "draft"),
    filter.poiId ? eq(poiFacts.poiId, filter.poiId) : undefined,
    filter.factType ? eq(poiFacts.factType, filter.factType) : undefined,
    filter.importBatchId === "legacy-unbatched"
      ? and(isNotNull(poiFactEditorialAudit.factId), isNull(poiFactEditorialAudit.importBatchId))
      : filter.importBatchId
        ? eq(poiFactEditorialAudit.importBatchId, filter.importBatchId)
        : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

  const draftRows = await db
    .select({ fact: poiFacts, poi: pois, audit: poiFactEditorialAudit })
    .from(poiFacts)
    .innerJoin(pois, eq(poiFacts.poiId, pois.id))
    .leftJoin(poiFactEditorialAudit, eq(poiFactEditorialAudit.factId, poiFacts.id))
    .where(and(...conditions));

  const poiIds = [...new Set(draftRows.map((row) => row.poi.id))];
  const reviewedRows = poiIds.length
    ? await db
        .select()
        .from(poiFacts)
        .where(and(inArray(poiFacts.poiId, poiIds), eq(poiFacts.status, "reviewed")))
    : [];

  return draftRows.map((row) =>
    DraftFactReviewQueueItemSchema.parse({
      poi: {
        id: row.poi.id,
        city: row.poi.city,
        category: row.poi.category,
        nameEn: row.poi.nameEn,
        ...(row.poi.nameZh ? { nameZh: row.poi.nameZh } : {}),
      },
      draft: rowToFact(row.fact),
      importContext: row.audit
        ? {
            collectionRowId: row.audit.collectionRowId,
            collectionStatus: row.audit.collectionStatus,
            importBatchId: row.audit.importBatchId,
            evidenceReviewedAt: row.audit.evidenceReviewedAt?.toISOString() ?? null,
          }
        : null,
      reviewedSiblings: reviewedRows
        .filter((candidate) => candidate.poiId === row.poi.id)
        .map(rowToFact),
    }),
  );
}

async function completeFactReview(
  db: Db,
  input: {
    factId: string;
    reviewedBy: string;
    requiredStatus: "draft" | "reviewed";
    expectedVersion?: number;
    expiresAt?: string | null;
  },
): Promise<PoiFact | null> {
  const existing = await getFact(db, input.factId);
  if (!existing) return null;
  if (existing.status !== input.requiredStatus) {
    throw new Error(
      input.requiredStatus === "draft"
        ? "Fact is no longer the unreviewed draft shown for confirmation"
        : "Only reviewed facts can be renewed",
    );
  }
  if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
    throw new Error("Fact is no longer the unreviewed draft shown for confirmation");
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
      .where(
        and(
          eq(poiFacts.id, input.factId),
          eq(poiFacts.status, input.requiredStatus),
          eq(poiFacts.version, existing.version),
        ),
      )
      .returning();
    if (!reviewed) {
      throw new Error(
        input.requiredStatus === "draft"
          ? "Fact is no longer the unreviewed draft shown for confirmation"
          : "Fact changed before renewal; refresh and try again",
      );
    }
    await transaction.insert(opsAuditEvents).values({
      actorId: input.reviewedBy,
      action: "knowledge.fact.review.completed",
      targetType: "poi_fact",
      targetId: input.factId,
      metadataJsonb: { reviewPolicy: review.reviewPolicy, version: reviewed.version },
    });
    return reviewed;
  });
  return rowToFact(row);
}

function rowToPoi(row: typeof pois.$inferSelect): Poi {
  return PoiSchema.parse({
    id: row.id,
    city: row.city,
    category: row.category,
    nameEn: row.nameEn,
    ...(row.nameZh ? { nameZh: row.nameZh } : {}),
    ...(row.address ? { address: row.address } : {}),
    ...(row.latitude !== null ? { latitude: Number(row.latitude) } : {}),
    ...(row.longitude !== null ? { longitude: Number(row.longitude) } : {}),
    sourceIds: row.sourceIds,
    facts: [],
    commercialLinks: [],
  });
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
