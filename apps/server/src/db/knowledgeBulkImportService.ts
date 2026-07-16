import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { poiFactEditorialAudit, poiFacts, pois } from "./schema.js";
import {
  prepareKnowledgeFactImport,
  type KnowledgeImportIssue,
  type KnowledgeImportRow,
  type PreparedKnowledgeImport,
} from "../modules/knowledge/bulkImport.js";

export class KnowledgeImportValidationError extends Error {
  constructor(readonly report: KnowledgeImportReport) {
    super("Knowledge import contains invalid rows");
  }
}

export type KnowledgeImportReport = {
  totalRows: number;
  readyRows: number;
  skippedRows: PreparedKnowledgeImport["skippedRows"];
  errors: KnowledgeImportIssue[];
  createdPois: number;
  mergedPois: number;
  createdFacts: number;
  duplicateFacts: number;
};

export type KnowledgeBulkImportService = {
  dryRun(csv: string): Promise<KnowledgeImportReport>;
  commit(csv: string): Promise<KnowledgeImportReport>;
};

export function createDbKnowledgeBulkImportService(db: Db): KnowledgeBulkImportService {
  return {
    async dryRun(csv) {
      const prepared = prepareKnowledgeFactImport(csv);
      if (prepared.errors.length > 0) return reportFor(prepared);
      return db.transaction(async (tx) => {
        const state = await loadState(tx);
        return inspect(prepared, state);
      });
    },

    async commit(csv) {
      const prepared = prepareKnowledgeFactImport(csv);
      if (prepared.errors.length > 0) throw new KnowledgeImportValidationError(reportFor(prepared));
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('visepanda:knowledge-bulk-import'))`,
        );
        const state = await loadState(tx);
        const report = inspect(prepared, state);
        if (report.errors.length > 0) throw new KnowledgeImportValidationError(report);

        const createdPoiKeys = new Set<string>();
        const mergedPoiKeys = new Set<string>();
        let createdFacts = 0;
        let duplicateFacts = 0;

        for (const row of prepared.readyRows) {
          const decision = decideRow(row, state);
          if (decision.kind === "error") throw new Error(decision.message);
          if (decision.kind === "duplicate") {
            duplicateFacts += 1;
            continue;
          }
          let poi = decision.poi;
          if (!poi) {
            const [created] = await tx
              .insert(pois)
              .values({
                ...(row.poiId ? { id: row.poiId } : {}),
                city: row.city,
                category: row.category,
                nameEn: row.nameEn,
                ...(row.nameZh ? { nameZh: row.nameZh } : {}),
                ...(row.address ? { address: row.address } : {}),
                ...(row.latitude !== undefined ? { latitude: String(row.latitude) } : {}),
                ...(row.longitude !== undefined ? { longitude: String(row.longitude) } : {}),
                sourceIds: row.sourceIds,
              })
              .returning();
            if (!created) throw new Error("POI insert returned no record");
            poi = created;
            state.pois.push(poi);
            state.poisById.set(poi.id, poi);
            state.poisByIdentity.set(poiIdentity(row), poi);
            addPoiSourceIdentities(state.poisBySourceIdentity, poi);
            createdPoiKeys.add(poi.id);
          } else {
            mergedPoiKeys.add(poi.id);
          }

          const [fact] = await tx
            .insert(poiFacts)
            .values({
              ...(row.factId ? { id: row.factId } : {}),
              poiId: poi.id,
              factType: row.factType,
              valueJsonb: row.value,
              confidence: String(row.confidence),
              source: row.sourceLocator,
              sourceClass: row.sourceClass,
              sourceLocator: row.sourceLocator,
              evidenceSummary: row.evidenceSummary,
              // Import never publishes a fact. Evidence review time is retained
              // in the private audit record until an explicit review transition.
              verifiedAt: null,
              ...(row.expiresAt ? { expiresAt: new Date(row.expiresAt) } : {}),
              status: "draft",
            })
            .returning();
          if (!fact) throw new Error("Fact insert returned no record");

          await tx.insert(poiFactEditorialAudit).values({
            factId: fact.id,
            collectionRowId: row.collectionRowId,
            contentDigest: contentDigest(row),
            collectionStatus: row.collectionStatus,
            researcher: row.researcher!,
            ...(row.reviewer ? { reviewer: row.reviewer } : {}),
            ...(row.verifiedAt ? { evidenceReviewedAt: new Date(row.verifiedAt) } : {}),
            ...(row.reviewNotes ? { reviewNotes: row.reviewNotes } : {}),
          });
          state.facts.push(fact);
          state.auditByCollectionRowId.set(row.collectionRowId, {
            factId: fact.id,
            contentDigest: contentDigest(row),
          });
          createdFacts += 1;
        }

        return {
          ...report,
          createdPois: createdPoiKeys.size,
          mergedPois: mergedPoiKeys.size,
          createdFacts,
          duplicateFacts,
        };
      });
    },
  };
}

type LoadedState = {
  pois: Array<typeof pois.$inferSelect>;
  facts: Array<typeof poiFacts.$inferSelect>;
  poisById: Map<string, typeof pois.$inferSelect>;
  poisByIdentity: Map<string, typeof pois.$inferSelect>;
  poisBySourceIdentity: Map<string, Array<typeof pois.$inferSelect>>;
  auditByCollectionRowId: Map<string, { factId: string; contentDigest: string }>;
};

async function loadState(db: Pick<Db, "select">): Promise<LoadedState> {
  const [poiRows, factRows, auditRows] = await Promise.all([
    db.select().from(pois),
    db.select().from(poiFacts),
    db.select().from(poiFactEditorialAudit),
  ]);
  return {
    pois: [...poiRows],
    facts: [...factRows],
    poisById: new Map(poiRows.map((poi) => [poi.id, poi])),
    poisByIdentity: new Map(
      poiRows.map((poi) => [
        poiIdentity({ city: poi.city, category: poi.category, nameEn: poi.nameEn }),
        poi,
      ]),
    ),
    poisBySourceIdentity: buildPoiSourceIdentityIndex(poiRows),
    auditByCollectionRowId: new Map(
      auditRows.map((audit) => [
        audit.collectionRowId,
        { factId: audit.factId, contentDigest: audit.contentDigest },
      ]),
    ),
  };
}

function inspect(prepared: PreparedKnowledgeImport, state: LoadedState): KnowledgeImportReport {
  const errors = [...prepared.errors];
  let createdPois = 0;
  let mergedPois = 0;
  let createdFacts = 0;
  let duplicateFacts = 0;
  const temporaryState = cloneState(state);

  for (const row of prepared.readyRows) {
    const decision = decideRow(row, temporaryState);
    if (decision.kind === "error") {
      errors.push({
        row: row.csvRow,
        collectionRowId: row.collectionRowId,
        message: decision.message,
      });
      continue;
    }
    if (decision.kind === "duplicate") {
      duplicateFacts += 1;
      continue;
    }
    if (decision.poi) mergedPois += 1;
    else {
      createdPois += 1;
      const temporaryPoi = {
        id: row.poiId ?? `new:${row.collectionRowId}`,
        city: row.city,
        category: row.category,
        nameEn: row.nameEn,
      } as typeof pois.$inferSelect;
      temporaryState.pois.push(temporaryPoi);
      temporaryState.poisById.set(temporaryPoi.id, temporaryPoi);
      temporaryState.poisByIdentity.set(poiIdentity(row), temporaryPoi);
      addPoiSourceIdentities(temporaryState.poisBySourceIdentity, {
        ...temporaryPoi,
        sourceIds: row.sourceIds,
      });
    }
    temporaryState.facts.push({
      id: row.factId ?? `new:${row.collectionRowId}`,
      poiId: decision.poi?.id ?? row.poiId ?? `new:${row.collectionRowId}`,
      factType: row.factType,
      valueJsonb: row.value,
      sourceLocator: row.sourceLocator,
    } as typeof poiFacts.$inferSelect);
    temporaryState.auditByCollectionRowId.set(row.collectionRowId, {
      factId: row.factId ?? `new:${row.collectionRowId}`,
      contentDigest: contentDigest(row),
    });
    createdFacts += 1;
  }

  return {
    totalRows: prepared.totalRows,
    readyRows: prepared.readyRows.length,
    skippedRows: prepared.skippedRows,
    errors,
    createdPois,
    mergedPois,
    createdFacts,
    duplicateFacts,
  };
}

function decideRow(
  row: KnowledgeImportRow,
  state: LoadedState,
):
  | { kind: "insert"; poi: typeof pois.$inferSelect | undefined }
  | { kind: "duplicate" }
  | { kind: "error"; message: string } {
  const digest = contentDigest(row);
  const replay = state.auditByCollectionRowId.get(row.collectionRowId);
  if (replay) {
    return replay.contentDigest === digest
      ? { kind: "duplicate" }
      : { kind: "error", message: "collection_row_id already exists with different content" };
  }
  const poiResolution = resolvePoi(row, state);
  if (poiResolution.error) return { kind: "error", message: poiResolution.error };
  const poi = poiResolution.poi;
  const targetPoiId = poi?.id ?? row.poiId;
  const matchingFact = state.facts.find(
    (fact) =>
      fact.poiId === targetPoiId &&
      fact.factType === row.factType &&
      fact.sourceLocator === row.sourceLocator &&
      stableJson(fact.valueJsonb) === stableJson(row.value),
  );
  if (matchingFact) return { kind: "duplicate" };
  if (row.factId && state.facts.some((fact) => fact.id === row.factId)) {
    return { kind: "error", message: "fact_id already exists with different content" };
  }
  return { kind: "insert", poi };
}

function reportFor(prepared: PreparedKnowledgeImport): KnowledgeImportReport {
  return {
    totalRows: prepared.totalRows,
    readyRows: prepared.readyRows.length,
    skippedRows: prepared.skippedRows,
    errors: prepared.errors,
    createdPois: 0,
    mergedPois: 0,
    createdFacts: 0,
    duplicateFacts: 0,
  };
}

function cloneState(state: LoadedState): LoadedState {
  return {
    pois: [...state.pois],
    facts: [...state.facts],
    poisById: new Map(state.poisById),
    poisByIdentity: new Map(state.poisByIdentity),
    poisBySourceIdentity: new Map(
      [...state.poisBySourceIdentity].map(([key, values]) => [key, [...values]]),
    ),
    auditByCollectionRowId: new Map(state.auditByCollectionRowId),
  };
}

function resolvePoi(
  row: KnowledgeImportRow,
  state: LoadedState,
): { poi?: typeof pois.$inferSelect; error?: string } {
  const byId = row.poiId ? state.poisById.get(row.poiId) : undefined;
  const byName = state.poisByIdentity.get(poiIdentity(row));
  const bySource = sourceIdentityEntries(row.sourceIds).flatMap(
    (identity) => state.poisBySourceIdentity.get(identity) ?? [],
  );
  const candidates = new Map<string, typeof pois.$inferSelect>();
  [byId, byName, ...bySource].forEach((candidate) => {
    if (candidate) candidates.set(candidate.id, candidate);
  });

  if (candidates.size > 1) {
    return { error: "POI identity fields resolve to different existing POIs" };
  }
  const poi = candidates.values().next().value as typeof pois.$inferSelect | undefined;
  if (row.poiId && !byId && poi) {
    return { error: "poi_id conflicts with an existing POI identity" };
  }
  if (byId && poiIdentity(byId) !== poiIdentity(row)) {
    return { error: "poi_id does not match the supplied POI identity" };
  }
  if (poi && (poi.city !== row.city || poi.category !== row.category)) {
    return { error: "stable POI source identity conflicts with city or category" };
  }
  return poi ? { poi } : {};
}

function buildPoiSourceIdentityIndex(
  poiRows: Array<typeof pois.$inferSelect>,
): Map<string, Array<typeof pois.$inferSelect>> {
  const index = new Map<string, Array<typeof pois.$inferSelect>>();
  poiRows.forEach((poi) => addPoiSourceIdentities(index, poi));
  return index;
}

function addPoiSourceIdentities(
  index: Map<string, Array<typeof pois.$inferSelect>>,
  poi: typeof pois.$inferSelect,
): void {
  sourceIdentityEntries(poi.sourceIds).forEach((identity) => {
    const values = index.get(identity) ?? [];
    if (!values.some((candidate) => candidate.id === poi.id)) values.push(poi);
    index.set(identity, values);
  });
}

function sourceIdentityEntries(sourceIds: unknown): string[] {
  if (!sourceIds || typeof sourceIds !== "object" || Array.isArray(sourceIds)) return [];
  return Object.entries(sourceIds)
    .filter(
      ([, value]) =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean",
    )
    .map(([source, value]) => `${source}:${String(value).trim()}`)
    .filter((identity) => !identity.endsWith(":"))
    .sort();
}

function poiIdentity(input: { city: string; category: string; nameEn: string }): string {
  return [input.city, input.category, input.nameEn.trim().toLocaleLowerCase("en-US")].join("|");
}

function contentDigest(row: KnowledgeImportRow): string {
  return createHash("sha256")
    .update(
      stableJson({
        poiId: row.poiId ?? null,
        city: row.city,
        category: row.category,
        nameEn: row.nameEn,
        nameZh: row.nameZh ?? null,
        address: row.address ?? null,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        sourceIds: row.sourceIds,
        factId: row.factId ?? null,
        factType: row.factType,
        value: row.value,
        confidence: row.confidence,
        verifiedAt: row.verifiedAt ?? null,
        expiresAt: row.expiresAt ?? null,
        sourceClass: row.sourceClass,
        sourceLocator: row.sourceLocator,
        evidenceSummary: row.evidenceSummary,
        collectionStatus: row.collectionStatus,
        researcher: row.researcher ?? null,
        reviewer: row.reviewer ?? null,
        reviewNotes: row.reviewNotes ?? null,
      }),
    )
    .digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
