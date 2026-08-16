import {
  PoiImageSchema,
  PoiImageTargetSchema,
  PoiImageUploadMetadataSchema,
  type PoiImage,
  type PoiImageTarget,
  type PoiImageUploadMetadata,
} from "@visepanda/domain";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "./client.js";
import { opsAuditEvents, poiImages } from "./schema.js";

export type PoiImageWriteInput = PoiImageUploadMetadata & {
  actorId: string;
  storagePath: string;
  byteSize: number;
  width: number;
  height: number;
};

export type PoiImageService = {
  listActive(): Promise<PoiImage[]>;
  getActive(imageId: string): Promise<PoiImage | null>;
  create(input: PoiImageWriteInput): Promise<PoiImage>;
  revoke(input: { imageId: string; actorId: string }): Promise<PoiImage | null>;
};

/**
 * Metadata/audit changes are one database transaction. Storage bytes are intentionally handled by
 * the Ops route because they require a server-only Supabase service role and cannot participate in
 * the Postgres transaction.
 */
export function createDbPoiImageService(db: Db): PoiImageService {
  return {
    async listActive() {
      return (
        await db
          .select()
          .from(poiImages)
          .where(isNull(poiImages.deletedAt))
          .orderBy(desc(poiImages.createdAt))
      ).map(rowToImage);
    },
    async getActive(imageId) {
      const [row] = await db
        .select()
        .from(poiImages)
        .where(and(eq(poiImages.id, imageId), isNull(poiImages.deletedAt)))
        .limit(1);
      return row ? rowToImage(row) : null;
    },
    async create(input) {
      const metadata = PoiImageUploadMetadataSchema.parse({
        target: input.target,
        attribution: input.attribution,
        licenseNote: input.licenseNote,
      });
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(poiImages)
          .values({
            storagePath: input.storagePath,
            targetKind: metadata.target.kind,
            poiId: metadata.target.kind === "poi" ? metadata.target.poiId : null,
            city: metadata.target.kind === "city" ? metadata.target.city : null,
            category: metadata.target.kind === "category" ? metadata.target.category : null,
            contentType: "image/webp",
            byteSize: input.byteSize,
            width: input.width,
            height: input.height,
            attribution: metadata.attribution,
            licenseNote: metadata.licenseNote,
            createdBy: input.actorId,
          })
          .returning();
        if (!row) throw new Error("POI image metadata insert failed.");
        await insertAudit(transaction, input.actorId, {
          action: "knowledge.poi_image.create.completed",
          targetType: "poi_image",
          targetId: row.id,
          metadata: { targetKind: metadata.target.kind },
        });
        return rowToImage(row);
      });
    },
    async revoke(input) {
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(poiImages)
          .set({ deletedAt: new Date(), deletedBy: input.actorId })
          .where(and(eq(poiImages.id, input.imageId), isNull(poiImages.deletedAt)))
          .returning();
        if (!row) return null;
        await insertAudit(transaction, input.actorId, {
          action: "knowledge.poi_image.delete.completed",
          targetType: "poi_image",
          targetId: row.id,
          metadata: { targetKind: row.targetKind },
        });
        return rowToImage(row);
      });
    },
  };
}

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function insertAudit(
  transaction: Transaction,
  actorId: string,
  input: { action: string; targetType: string; targetId: string; metadata: Record<string, string> },
) {
  const [row] = await transaction
    .insert(opsAuditEvents)
    .values({
      actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadataJsonb: input.metadata,
    })
    .returning({ id: opsAuditEvents.id });
  if (!row) throw new Error("POI image audit insert failed.");
}

function rowToImage(row: typeof poiImages.$inferSelect): PoiImage {
  const target = PoiImageTargetSchema.parse(
    row.targetKind === "poi"
      ? { kind: "poi", poiId: row.poiId }
      : row.targetKind === "city"
        ? { kind: "city", city: row.city }
        : { kind: "category", category: row.category },
  );
  return PoiImageSchema.parse({
    id: row.id,
    target,
    storagePath: row.storagePath,
    contentType: row.contentType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    attribution: row.attribution,
    licenseNote: row.licenseNote,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  });
}
