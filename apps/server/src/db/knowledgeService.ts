import {
  KnowledgeGapSchema,
  PoiFactSchema,
  PoiSchema,
  type KnowledgeGap,
  type Poi,
  type PoiCategory,
  type PoiFact,
} from "@visepanda/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { knowledgeGaps, poiCommercialLinks, poiFacts, pois } from "./schema.js";
import type { KnowledgeService } from "../modules/knowledge/service.js";

export function createDbKnowledgeService(db: Db): KnowledgeService {
  return {
    async listPois(input = {}) {
      return listPois(db, input);
    },
    async createFact(input) {
      const [row] = await db
        .insert(poiFacts)
        .values({
          poiId: input.poiId,
          factType: input.factType,
          valueJsonb: input.value,
          confidence: String(input.confidence),
          source: input.source,
          verifiedAt: new Date(),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          status: "active",
        })
        .returning();
      if (!row) throw new Error("Fact insert failed");
      return rowToFact(row);
    },
    async updateFact(input) {
      const existing = await getFact(db, input.factId);
      if (!existing) throw new Error("Fact not found");
      await db
        .update(poiFacts)
        .set({
          valueJsonb: input.value,
          confidence: String(input.confidence ?? existing.confidence),
          source: input.source ?? existing.source,
          verifiedAt: new Date(),
          expiresAt:
            input.expiresAt === undefined
              ? existing.expiresAt
                ? new Date(existing.expiresAt)
                : null
              : input.expiresAt
                ? new Date(input.expiresAt)
                : null,
          version: existing.version + 1,
        })
        .where(eq(poiFacts.id, input.factId));
      return listPois(db);
    },
    async listExpiredFacts(input = {}) {
      const all = await listPois(db, { includeExpired: true });
      const now = input.now ?? new Date();
      return all.flatMap((poi) =>
        poi.facts.filter(
          (fact) =>
            fact.status === "active" &&
            fact.expiresAt !== null &&
            Date.parse(fact.expiresAt) < now.getTime(),
        ),
      );
    },
    async renewFact(input) {
      const existing = await getFact(db, input.factId);
      if (!existing) return null;
      const [row] = await db
        .update(poiFacts)
        .set({
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          status: "active",
          verifiedAt: new Date(),
          version: existing.version + 1,
        })
        .where(eq(poiFacts.id, input.factId))
        .returning();
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
        .filter(
          (fact) =>
            (input.includeExpired || !fact.expiresAt || Date.parse(fact.expiresAt) >= Date.now()) &&
            (input.includeDeprecated || fact.status !== "deprecated"),
        ),
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
    verifiedAt: row.verifiedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
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
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
