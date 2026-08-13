import {
  SeoEditorialOverrideMutationSchema,
  SeoEditorialOverrideSchema,
  type SeoEditorialOverride,
} from "@visepanda/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { seoEditorialOverrides } from "./schema.js";
import type { SeoEditorialOverrideService } from "../modules/seo/editorialOverrideService.js";

/**
 * This store is deliberately presentation-only. Candidate eligibility is checked by the caller
 * before save and before public application; this relation never reads or mutates POI facts.
 */
export function createDbSeoEditorialOverrideService(
  db: Db,
  options: { now?: () => Date } = {},
): SeoEditorialOverrideService {
  const now = options.now ?? (() => new Date());

  return {
    async get(input) {
      const [row] = await db
        .select()
        .from(seoEditorialOverrides)
        .where(
          and(
            eq(seoEditorialOverrides.poiId, input.poiId),
            eq(seoEditorialOverrides.intent, input.intent),
          ),
        )
        .limit(1);
      return row ? rowToOverride(row) : null;
    },
    async save(input) {
      const { actorId, ...rawMutation } = input;
      const mutation = SeoEditorialOverrideMutationSchema.parse(rawMutation);
      const timestamp = now();
      const [row] = await db
        .insert(seoEditorialOverrides)
        .values({
          ...mutation,
          createdBy: actorId,
          updatedBy: actorId,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: [seoEditorialOverrides.poiId, seoEditorialOverrides.intent],
          set: {
            title: mutation.title,
            summary: mutation.summary,
            emphasis: mutation.emphasis,
            updatedBy: actorId,
            updatedAt: timestamp,
          },
        })
        .returning();
      if (!row) throw new Error("SEO editorial override write failed.");
      return rowToOverride(row);
    },
    async delete(input) {
      const deleted = await db
        .delete(seoEditorialOverrides)
        .where(
          and(
            eq(seoEditorialOverrides.poiId, input.poiId),
            eq(seoEditorialOverrides.intent, input.intent),
          ),
        )
        .returning({ id: seoEditorialOverrides.id });
      return deleted.length > 0;
    },
  };
}

function rowToOverride(row: typeof seoEditorialOverrides.$inferSelect): SeoEditorialOverride {
  return SeoEditorialOverrideSchema.parse({
    poiId: row.poiId,
    intent: row.intent,
    title: row.title,
    summary: row.summary,
    emphasis: row.emphasis,
    updatedAt: row.updatedAt.toISOString(),
  });
}
