import {
  ContentAiWalkingSkeletonDraftSchema,
  PoiFactEvidenceSchema,
  PoiLocalPresentationFactValueSchema,
  hasReviewablePoiFactEvidence,
  resolvePoiFactReview,
  type ContentAiWalkingSkeletonDraft,
  type PoiFactSourceClass,
} from "@visepanda/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { contentAiWalkingSkeletonDrafts, opsAuditEvents, poiFacts, pois } from "./schema.js";

export class ContentAiWalkingSkeletonConflictError extends Error {
  constructor() {
    super("The displayed draft is stale. Refresh the POI and rebase before publishing.");
    this.name = "ContentAiWalkingSkeletonConflictError";
  }
}

export class ContentAiWalkingSkeletonNotFoundError extends Error {
  constructor() {
    super("Content AI walking skeleton draft was not found.");
    this.name = "ContentAiWalkingSkeletonNotFoundError";
  }
}

export type ContentAiWalkingSkeletonService = {
  createFixtureDraft(input: {
    ownerId: string;
    poiId: string;
    afterText: string;
    sourceClass: PoiFactSourceClass;
    sourceLocator: string;
    evidenceSummary: string;
  }): Promise<ContentAiWalkingSkeletonDraft>;
  getDraft(input: {
    draftId: string;
    requesterId: string;
    canReview: boolean;
  }): Promise<ContentAiWalkingSkeletonDraft | null>;
  publishDraft(input: {
    draftId: string;
    reviewerId: string;
  }): Promise<ContentAiWalkingSkeletonDraft>;
};

export function createDbContentAiWalkingSkeletonService(db: Db): ContentAiWalkingSkeletonService {
  return {
    async createFixtureDraft(input) {
      const evidence = PoiFactEvidenceSchema.parse(input);
      const after = PoiLocalPresentationFactValueSchema.parse({ text: input.afterText });
      const [poi] = await db
        .select({ id: pois.id })
        .from(pois)
        .where(eq(pois.id, input.poiId))
        .limit(1);
      if (!poi) throw new ContentAiWalkingSkeletonNotFoundError();

      return db.transaction(async (transaction) => {
        const [fact] = await transaction
          .insert(poiFacts)
          .values({
            poiId: input.poiId,
            factType: "local_address_nearest_metro_exit",
            valueJsonb: after,
            confidence: "0.5",
            source: evidence.sourceLocator,
            sourceClass: evidence.sourceClass,
            sourceLocator: evidence.sourceLocator,
            evidenceSummary: evidence.evidenceSummary,
            status: "draft",
          })
          .returning();
        if (!fact) throw new Error("Content AI walking skeleton fact insert failed.");
        const [draft] = await transaction
          .insert(contentAiWalkingSkeletonDrafts)
          .values({
            ownerId: input.ownerId,
            poiId: input.poiId,
            factId: fact.id,
            factType: "local_address_nearest_metro_exit",
            beforeValueJsonb: null,
            afterValueJsonb: after,
            sourceClass: evidence.sourceClass,
            sourceLocator: evidence.sourceLocator,
            evidenceSummary: evidence.evidenceSummary,
            riskLevel: "execution",
            expectedFactVersion: fact.version,
            state: "draft",
          })
          .returning();
        if (!draft) throw new Error("Content AI walking skeleton draft insert failed.");
        await transaction.insert(opsAuditEvents).values({
          actorId: input.ownerId,
          action: "content_ai.walking_skeleton.draft.created",
          targetType: "content_ai_walking_skeleton_draft",
          targetId: draft.id,
          metadataJsonb: { poiId: input.poiId, factId: fact.id, factType: draft.factType },
        });
        return rowToDraft(draft);
      });
    },
    async getDraft(input) {
      const [row] = await db
        .select()
        .from(contentAiWalkingSkeletonDrafts)
        .where(eq(contentAiWalkingSkeletonDrafts.id, input.draftId))
        .limit(1);
      if (!row) return null;
      if (row.ownerId !== input.requesterId && !input.canReview) return null;
      return rowToDraft(row);
    },
    async publishDraft(input) {
      const [draft] = await db
        .select()
        .from(contentAiWalkingSkeletonDrafts)
        .where(eq(contentAiWalkingSkeletonDrafts.id, input.draftId))
        .limit(1);
      if (!draft) throw new ContentAiWalkingSkeletonNotFoundError();
      if (draft.ownerId === input.reviewerId || draft.state !== "draft") {
        throw new ContentAiWalkingSkeletonConflictError();
      }

      const result = await db.transaction(async (transaction) => {
        const [fact] = await transaction
          .select()
          .from(poiFacts)
          .where(eq(poiFacts.id, draft.factId))
          .limit(1);
        if (!fact || fact.poiId !== draft.poiId || fact.status !== "draft") {
          return {
            kind: "conflict" as const,
            draft: await markConflict(transaction, draft.id, input.reviewerId),
          };
        }
        const evidence = PoiFactEvidenceSchema.parse({
          sourceClass: fact.sourceClass,
          sourceLocator: fact.sourceLocator,
          evidenceSummary: fact.evidenceSummary,
        });
        const candidate = {
          sourceClass: evidence.sourceClass,
          sourceLocator: evidence.sourceLocator,
          evidenceSummary: evidence.evidenceSummary,
        };
        if (!hasReviewablePoiFactEvidence(candidate)) {
          throw new Error("Content AI walking skeleton fact has insufficient review evidence.");
        }
        const verifiedAt = new Date();
        const review = resolvePoiFactReview({
          factType: fact.factType,
          verifiedAt,
        });
        const [reviewed] = await transaction
          .update(poiFacts)
          .set({
            status: "reviewed",
            reviewedBy: input.reviewerId,
            verifiedAt,
            expiresAt: new Date(review.expiresAt),
            reviewPolicy: review.reviewPolicy,
            version: fact.version + 1,
          })
          .where(
            and(
              eq(poiFacts.id, draft.factId),
              eq(poiFacts.status, "draft"),
              eq(poiFacts.version, draft.expectedFactVersion),
            ),
          )
          .returning();
        if (!reviewed) {
          return {
            kind: "conflict" as const,
            draft: await markConflict(transaction, draft.id, input.reviewerId),
          };
        }
        const [published] = await transaction
          .update(contentAiWalkingSkeletonDrafts)
          .set({ state: "published", updatedAt: new Date() })
          .where(
            and(
              eq(contentAiWalkingSkeletonDrafts.id, draft.id),
              eq(contentAiWalkingSkeletonDrafts.state, "draft"),
            ),
          )
          .returning();
        if (!published) throw new ContentAiWalkingSkeletonConflictError();
        await transaction.insert(opsAuditEvents).values({
          actorId: input.reviewerId,
          action: "content_ai.walking_skeleton.published",
          targetType: "content_ai_walking_skeleton_draft",
          targetId: draft.id,
          metadataJsonb: {
            poiId: draft.poiId,
            factId: draft.factId,
            expectedFactVersion: draft.expectedFactVersion,
            publishedFactVersion: reviewed.version,
          },
        });
        return { kind: "published" as const, draft: rowToDraft(published) };
      });
      if (result.kind === "conflict") throw new ContentAiWalkingSkeletonConflictError();
      return result.draft;
    },
  };
}

async function markConflict(
  transaction: Parameters<Parameters<Db["transaction"]>[0]>[0],
  draftId: string,
  actorId: string,
): Promise<ContentAiWalkingSkeletonDraft> {
  const [conflicted] = await transaction
    .update(contentAiWalkingSkeletonDrafts)
    .set({ state: "conflict", updatedAt: new Date() })
    .where(
      and(
        eq(contentAiWalkingSkeletonDrafts.id, draftId),
        eq(contentAiWalkingSkeletonDrafts.state, "draft"),
      ),
    )
    .returning();
  if (!conflicted) throw new ContentAiWalkingSkeletonConflictError();
  await transaction.insert(opsAuditEvents).values({
    actorId,
    action: "content_ai.walking_skeleton.conflict",
    targetType: "content_ai_walking_skeleton_draft",
    targetId: draftId,
    metadataJsonb: {},
  });
  return rowToDraft(conflicted);
}

function rowToDraft(
  row: typeof contentAiWalkingSkeletonDrafts.$inferSelect,
): ContentAiWalkingSkeletonDraft {
  return ContentAiWalkingSkeletonDraftSchema.parse({
    id: row.id,
    ownerId: row.ownerId,
    poiId: row.poiId,
    factId: row.factId,
    factType: row.factType,
    before: row.beforeValueJsonb,
    after: row.afterValueJsonb,
    evidence: {
      sourceClass: row.sourceClass,
      sourceLocator: row.sourceLocator,
      evidenceSummary: row.evidenceSummary,
    },
    riskLevel: row.riskLevel,
    expectedFactVersion: row.expectedFactVersion,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
