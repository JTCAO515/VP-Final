import {
  PoiCategorySchema,
  PoiFactEvidenceSummarySchema,
  PoiFactSourceClassSchema,
  PoiFactSourceLocatorSchema,
} from "@visepanda/domain";
import { z } from "zod";

const SIX_CITY_NAMES = [
  "Beijing",
  "Shanghai",
  "Chengdu",
  "Guangzhou",
  "Shenzhen",
  "Xi'an",
] as const;

export const SixCitySchema = z.enum(SIX_CITY_NAMES);
export const KnowledgeCollectionStatusSchema = z.enum([
  "missing",
  "researched",
  "conflict",
  "reviewed",
  "rejected",
]);

const EditorHandleSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/)
  .transform((value) => value.toLowerCase());
const ReviewNotesSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value), {
    message: "Review notes must not contain an email address",
  })
  .refine((value) => !/\b(?:\+?\d[\d\s()-]{6,}\d)\b/.test(value), {
    message: "Review notes must not contain a phone number",
  });

const ImportRowSchema = z.object({
  collectionRowId: z.string().trim().min(1).max(120),
  poiId: z.string().uuid().optional(),
  city: SixCitySchema,
  category: PoiCategorySchema,
  nameEn: z.string().trim().min(1).max(200),
  nameZh: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  sourceIds: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .refine(
      (value) => Object.keys(value).length > 0,
      "source_ids_json must retain at least one stable source identity",
    ),
  factId: z.string().uuid().optional(),
  factStatus: z.literal("draft").optional(),
  factType: z.string().trim().min(1).max(120),
  value: z
    .record(z.unknown())
    .refine((value) => Object.keys(value).length > 0, "value_json is required"),
  confidence: z.number().min(0).max(1),
  expiresAt: z.string().datetime().optional(),
  sourceClass: PoiFactSourceClassSchema,
  sourceLocator: PoiFactSourceLocatorSchema,
  evidenceSummary: PoiFactEvidenceSummarySchema,
  collectionStatus: KnowledgeCollectionStatusSchema,
  researcher: EditorHandleSchema.optional(),
  reviewer: EditorHandleSchema.optional(),
  reviewNotes: ReviewNotesSchema.optional(),
  verifiedAt: z.string().datetime().optional(),
});

export type KnowledgeImportRow = z.infer<typeof ImportRowSchema>;
export type PreparedKnowledgeImportRow = KnowledgeImportRow & { csvRow: number };

export type KnowledgeImportIssue = {
  row: number;
  collectionRowId: string | null;
  message: string;
};

export type PreparedKnowledgeImport = {
  totalRows: number;
  readyRows: PreparedKnowledgeImportRow[];
  skippedRows: Array<{ row: number; collectionRowId: string; reason: string }>;
  errors: KnowledgeImportIssue[];
};

export const KNOWLEDGE_FACT_IMPORT_HEADERS = [
  "collection_row_id",
  "poi_id",
  "city",
  "category",
  "name_en",
  "name_zh",
  "address",
  "latitude",
  "longitude",
  "source_ids_json",
  "fact_id",
  "fact_type",
  "value_json",
  "confidence",
  "fact_status",
  "verified_at",
  "expires_at",
  "source_class",
  "source_locator",
  "evidence_summary",
  "collection_status",
  "researcher",
  "reviewer",
  "review_notes",
] as const;

type RequiredHeader = (typeof KNOWLEDGE_FACT_IMPORT_HEADERS)[number];
type CsvSource = Record<RequiredHeader, string>;

const MAX_IMPORT_BYTES = 1_000_000;
const MAX_IMPORT_ROWS = 1_000;

export function prepareKnowledgeFactImport(csv: string, now = new Date()): PreparedKnowledgeImport {
  if (Buffer.byteLength(csv, "utf8") > MAX_IMPORT_BYTES) {
    return {
      totalRows: 0,
      readyRows: [],
      skippedRows: [],
      errors: [{ row: 0, collectionRowId: null, message: "CSV exceeds the 1 MB import limit" }],
    };
  }

  const parsed = parseCsv(csv);
  if (parsed.error) {
    return {
      totalRows: 0,
      readyRows: [],
      skippedRows: [],
      errors: [{ row: 0, collectionRowId: null, message: parsed.error }],
    };
  }
  if (parsed.rows.length === 0) {
    return { totalRows: 0, readyRows: [], skippedRows: [], errors: [] };
  }

  const header = parsed.rows[0]!;
  header[0] = header[0]?.replace(/^\uFEFF/, "") ?? "";
  const records = parsed.rows.slice(1);
  const missingHeaders = KNOWLEDGE_FACT_IMPORT_HEADERS.filter(
    (required) => !header.includes(required),
  );
  const unexpectedHeaders = header.filter(
    (candidate) =>
      !KNOWLEDGE_FACT_IMPORT_HEADERS.includes(candidate as RequiredHeader) ||
      header.indexOf(candidate) !== header.lastIndexOf(candidate),
  );
  if (missingHeaders.length > 0 || unexpectedHeaders.length > 0) {
    const details = [
      ...(missingHeaders.length > 0
        ? [`missing required headers: ${missingHeaders.join(", ")}`]
        : []),
      ...(unexpectedHeaders.length > 0
        ? [`unexpected or duplicate headers: ${[...new Set(unexpectedHeaders)].join(", ")}`]
        : []),
    ];
    return {
      totalRows: records.length,
      readyRows: [],
      skippedRows: [],
      errors: [
        {
          row: 1,
          collectionRowId: null,
          message: `CSV header mismatch: ${details.join("; ")}`,
        },
      ],
    };
  }
  if (records.length > MAX_IMPORT_ROWS) {
    return {
      totalRows: records.length,
      readyRows: [],
      skippedRows: [],
      errors: [
        { row: 0, collectionRowId: null, message: "CSV exceeds the 1,000 row import limit" },
      ],
    };
  }

  const headerIndex = new Map(header.map((value, index) => [value, index]));
  const readyRows: PreparedKnowledgeImportRow[] = [];
  const skippedRows: PreparedKnowledgeImport["skippedRows"] = [];
  const errors: KnowledgeImportIssue[] = [];
  const seenCollectionIds = new Set<string>();

  records.forEach((record, index) => {
    const row = index + 2;
    if (record.every((value) => value.trim() === "")) return;
    const source = Object.fromEntries(
      KNOWLEDGE_FACT_IMPORT_HEADERS.map((key) => [key, record[headerIndex.get(key)!] ?? ""]),
    ) as CsvSource;
    const collectionRowId = source.collection_row_id.trim() || null;
    if (record.length !== header.length) {
      errors.push({ row, collectionRowId, message: "CSV column count does not match the header" });
      return;
    }
    if (collectionRowId && seenCollectionIds.has(collectionRowId)) {
      errors.push({
        row,
        collectionRowId,
        message: "collection_row_id is duplicated in this file",
      });
      return;
    }
    if (collectionRowId) seenCollectionIds.add(collectionRowId);

    const collectionStatus = KnowledgeCollectionStatusSchema.safeParse(
      source.collection_status.trim(),
    );
    if (!collectionStatus.success) {
      errors.push({ row, collectionRowId, message: "collection_status is invalid" });
      return;
    }
    if (
      collectionStatus.data === "missing" ||
      collectionStatus.data === "conflict" ||
      collectionStatus.data === "rejected"
    ) {
      if (!collectionRowId) {
        errors.push({ row, collectionRowId, message: "collection_row_id is required" });
      } else {
        skippedRows.push({
          row,
          collectionRowId,
          reason: `collection_status=${collectionStatus.data} is not importable`,
        });
      }
      return;
    }

    const normalized = normalizeRow(source);
    if (!normalized.ok) {
      errors.push({ row, collectionRowId, message: normalized.message });
      return;
    }
    const result = ImportRowSchema.safeParse(normalized.value);
    if (!result.success) {
      errors.push({
        row,
        collectionRowId,
        message: result.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    const lifecycle = validateCollectionLifecycle(result.data, now);
    if (lifecycle.error) {
      errors.push({ row, collectionRowId, message: lifecycle.error });
      return;
    }
    if (lifecycle.skipReason) {
      skippedRows.push({
        row,
        collectionRowId: result.data.collectionRowId,
        reason: lifecycle.skipReason,
      });
      return;
    }
    readyRows.push({ ...result.data, csvRow: row });
  });

  return { totalRows: records.length, readyRows, skippedRows, errors };
}

function normalizeRow(
  source: CsvSource,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  const sourceIds = parseJsonObject(source.source_ids_json, "source_ids_json");
  if (!sourceIds.ok) return sourceIds;
  const value = parseJsonObject(source.value_json, "value_json");
  if (!value.ok) return value;
  const latitude = parseOptionalNumber(source.latitude, "latitude");
  if (!latitude.ok) return latitude;
  const longitude = parseOptionalNumber(source.longitude, "longitude");
  if (!longitude.ok) return longitude;
  const confidence = parseRequiredNumber(source.confidence, "confidence");
  if (!confidence.ok) return confidence;

  return {
    ok: true,
    value: {
      collectionRowId: source.collection_row_id,
      ...(blankToUndefined(source.poi_id) ? { poiId: blankToUndefined(source.poi_id) } : {}),
      city: source.city.trim(),
      category: source.category.trim(),
      nameEn: source.name_en,
      ...(blankToUndefined(source.name_zh) ? { nameZh: blankToUndefined(source.name_zh) } : {}),
      ...(blankToUndefined(source.address) ? { address: blankToUndefined(source.address) } : {}),
      ...(latitude.value !== undefined ? { latitude: latitude.value } : {}),
      ...(longitude.value !== undefined ? { longitude: longitude.value } : {}),
      sourceIds: sourceIds.value,
      ...(blankToUndefined(source.fact_id) ? { factId: blankToUndefined(source.fact_id) } : {}),
      ...(blankToUndefined(source.fact_status)
        ? { factStatus: blankToUndefined(source.fact_status) }
        : {}),
      factType: source.fact_type,
      value: value.value,
      confidence: confidence.value,
      ...(blankToUndefined(source.verified_at)
        ? { verifiedAt: blankToUndefined(source.verified_at) }
        : {}),
      ...(blankToUndefined(source.expires_at)
        ? { expiresAt: blankToUndefined(source.expires_at) }
        : {}),
      sourceClass: source.source_class.trim(),
      sourceLocator: source.source_locator,
      evidenceSummary: source.evidence_summary,
      collectionStatus: source.collection_status.trim(),
      ...(blankToUndefined(source.researcher)
        ? { researcher: blankToUndefined(source.researcher) }
        : {}),
      ...(blankToUndefined(source.reviewer) ? { reviewer: blankToUndefined(source.reviewer) } : {}),
      ...(blankToUndefined(source.review_notes)
        ? { reviewNotes: blankToUndefined(source.review_notes) }
        : {}),
    },
  };
}

function validateCollectionLifecycle(
  row: KnowledgeImportRow,
  now: Date,
): { error?: string; skipReason?: string } {
  if ((row.latitude === undefined) !== (row.longitude === undefined)) {
    return { error: "latitude and longitude must be supplied together" };
  }
  if (!row.researcher) return { error: "researcher is required for importable rows" };
  if (row.collectionStatus === "reviewed") {
    if (!row.reviewer) return { error: "reviewer is required for reviewed rows" };
    if (row.reviewer === row.researcher) {
      return { error: "reviewer must be independent from researcher for reviewed rows" };
    }
    if (!row.verifiedAt) return { error: "verified_at is required for reviewed rows" };
    if (Date.parse(row.verifiedAt) > now.getTime()) {
      return { error: "verified_at must not be in the future" };
    }
    if (!row.expiresAt && !row.reviewNotes) {
      return { error: "review_notes must justify a reviewed fact without expires_at" };
    }
    if (row.expiresAt && Date.parse(row.expiresAt) < Date.parse(row.verifiedAt)) {
      return { error: "expires_at must not be earlier than verified_at" };
    }
  }
  if (row.collectionStatus === "researched") {
    if (row.reviewer) {
      return { error: "researched rows must not name a reviewer before independent review" };
    }
    if (row.verifiedAt) {
      return { error: "researched rows must not claim verified_at before independent review" };
    }
  }
  return {};
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseJsonObject(
  value: string,
  field: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, message: `${field} must be a JSON object` };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: `${field} must be valid JSON` };
  }
}

function parseOptionalNumber(
  value: string,
  field: string,
): { ok: true; value: number | undefined } | { ok: false; message: string } {
  if (value.trim() === "") return { ok: true, value: undefined };
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? { ok: true, value: parsed }
    : { ok: false, message: `${field} must be a finite number` };
}

function parseRequiredNumber(
  value: string,
  field: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed)
    ? { ok: true, value: parsed }
    : { ok: false, message: `${field} must be a finite number` };
}

function parseCsv(input: string): { rows: string[][]; error?: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      if (field !== "") return { rows: [], error: "CSV quote must begin at a field boundary" };
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) return { rows: [], error: "CSV contains an unterminated quoted field" };
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return { rows };
}
