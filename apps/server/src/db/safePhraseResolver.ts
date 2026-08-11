import { SafePhraseSchema, type SafePhrase } from "@visepanda/domain";
import { and, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { safePhrases } from "./schema.js";
import type { SafePhraseResolver } from "../modules/copilot/executionSafety.js";

/**
 * This resolver deliberately has no broad browse or semantic-search path. A caller must provide
 * every selection dimension, and the pipeline rechecks eligibility before presentation.
 */
export function createDbSafePhraseResolver(db: Db): SafePhraseResolver {
  return async (selection) => {
    const [row] = await db
      .select()
      .from(safePhrases)
      .where(
        and(
          eq(safePhrases.category, selection.category),
          eq(safePhrases.scene, selection.scene),
          eq(safePhrases.intentKey, selection.intentKey),
          eq(safePhrases.variantKey, selection.variantKey),
          eq(safePhrases.severity, selection.severity),
          eq(safePhrases.status, "reviewed"),
        ),
      )
      .limit(1);
    return row ? rowToSafePhrase(row) : null;
  };
}

function rowToSafePhrase(row: {
  id: string;
  category: string;
  scene: string;
  intentKey: string;
  variantKey: string;
  severity: string;
  chineseExpression: string;
  englishIntent: string;
  sourceClass: string;
  sourceLocator: string;
  evidenceSummary: string;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  reviewPolicy: string | null;
  status: string;
  createdAt: Date;
}): SafePhrase {
  return SafePhraseSchema.parse({
    id: row.id,
    category: row.category,
    scene: row.scene,
    intentKey: row.intentKey,
    variantKey: row.variantKey,
    severity: row.severity,
    chineseExpression: row.chineseExpression,
    englishIntent: row.englishIntent,
    sourceClass: row.sourceClass,
    sourceLocator: row.sourceLocator,
    evidenceSummary: row.evidenceSummary,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    reviewPolicy: row.reviewPolicy,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  });
}
