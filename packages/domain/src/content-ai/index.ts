import { z } from "zod";
import {
  PoiFactEvidenceSchema,
  PoiFactSourceClassSchema,
  isEligiblePoiFact,
  type PoiFact,
  type PoiFactSourceClass,
} from "../knowledge/index.js";

const ContentAiIdSchema = z.string().uuid();
const ContentAiDateTimeSchema = z.string().datetime();
const ContentAiSafeTextSchema = z.string().trim().min(1).max(10_000);
const ContentAiSummarySchema = z.string().trim().min(1).max(500);

const SENSITIVE_KEY_PATTERN =
  /(?:api[_-]?key|authorization|cookie|signature|database[_-]?url|service[_-]?role|access[_-]?token|refresh[_-]?token)/i;
const SENSITIVE_VALUE_PATTERNS = [
  /(?:postgres|postgresql):\/\//i,
  /\b(?:sk|ghp|gho)_[a-z0-9_-]{8,}/i,
  /\bsb_secret_[a-z0-9_-]{8,}/i,
  /\bbearer\s+[a-z0-9._-]{8,}/i,
  /(?:set-)?cookie\s*[:=]/i,
  /(?:signature|sig)\s*=/i,
];

export type ContentAiSensitiveRecordViolation = {
  path: string;
  reason: "sensitive_key" | "sensitive_value";
};

// Content AI receives untrusted material. This guard is intentionally reusable by every later
// persistence boundary so secrets cannot move from browser or provider input into a draft record.
export function findContentAiSensitiveRecordViolation(
  value: unknown,
  path = "$",
): ContentAiSensitiveRecordViolation | null {
  if (typeof value === "string") {
    return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))
      ? { path, reason: "sensitive_value" }
      : null;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const violation = findContentAiSensitiveRecordViolation(item, `${path}[${index}]`);
      if (violation) return violation;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key))
        return { path: `${path}.${key}`, reason: "sensitive_key" };
      const violation = findContentAiSensitiveRecordViolation(item, `${path}.${key}`);
      if (violation) return violation;
    }
  }
  return null;
}

export function rejectContentAiSensitiveRecord(value: unknown): void {
  const violation = findContentAiSensitiveRecordViolation(value);
  if (violation)
    throw new Error(`Content AI record rejected: ${violation.reason} at ${violation.path}`);
}

function isContentAiSecretSafe(value: unknown, context: z.RefinementCtx): void {
  const violation = findContentAiSensitiveRecordViolation(value);
  if (!violation) return;
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `Content AI records must not contain ${violation.reason}`,
  });
}

export const ContentAiJsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(10_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(ContentAiJsonValueSchema).max(100),
    z.record(ContentAiJsonValueSchema),
  ]),
);

export const ContentAiSecretSafeJsonValueSchema =
  ContentAiJsonValueSchema.superRefine(isContentAiSecretSafe);

export const ContentAiBusinessStatusSchema = z.enum([
  "draft",
  "needs_input",
  "in_review",
  "approved",
  "published",
  "rejected",
  "cancelled",
]);

export const ContentAiProcessingStateSchema = z.enum(["idle", "analyzing", "failed"]);

export const ContentAiTargetRouteSchema = z.enum([
  "supabase_content_draft",
  "supabase_storage_draft",
  "import_batch",
  "github_issue_draft",
  "no_mutation",
]);

export const ContentAiTargetTypeSchema = z.enum([
  "poi",
  "poi_fact",
  "editorial_draft",
  "media_draft",
  "import_batch",
  "github_issue_draft",
]);

export const ContentAiOperationActionSchema = z.enum([
  "create",
  "update",
  "attach_source",
  "upload_media",
  "create_editorial",
  "mark_missing_information",
]);

export const ContentAiRiskLevelSchema = z.enum([
  "low",
  "standard",
  "execution",
  "medical_or_safety",
  "commercial",
]);

export const ContentAiHumanDecisionSchema = z.enum([
  "pending",
  "approved",
  "corrected",
  "rejected",
  "cancelled",
  "rebase_requested",
]);

export const ContentAiOperationConflictCodeSchema = z.enum([
  "stale_version",
  "target_missing",
  "forbidden_overwrite",
]);

export const ContentAiOperationConflictSchema = z.object({
  code: ContentAiOperationConflictCodeSchema,
  expectedVersion: z.number().int().positive(),
  currentVersion: z.number().int().positive().nullable(),
  message: z.string().trim().min(1).max(240),
});

export const ContentAiSourceSchema = PoiFactEvidenceSchema.extend({
  id: ContentAiIdSchema,
  observedAt: ContentAiDateTimeSchema.nullable(),
  retrievedAt: ContentAiDateTimeSchema.nullable(),
  verifiedAt: ContentAiDateTimeSchema.nullable(),
  expiresAt: ContentAiDateTimeSchema.nullable(),
  verificationState: z.enum(["draft", "reviewed", "historical", "rejected"]),
}).superRefine(isContentAiSecretSafe);

export const ContentAiDraftOperationSchema = z
  .object({
    id: ContentAiIdSchema,
    targetRoute: ContentAiTargetRouteSchema,
    targetType: ContentAiTargetTypeSchema,
    targetEntityId: ContentAiIdSchema,
    action: ContentAiOperationActionSchema,
    fieldType: z.string().trim().min(1).max(120),
    before: ContentAiSecretSafeJsonValueSchema.nullable(),
    after: ContentAiSecretSafeJsonValueSchema.nullable(),
    sources: z.array(ContentAiSourceSchema).max(20),
    riskLevel: ContentAiRiskLevelSchema,
    aiConfidence: z.number().min(0).max(1).nullable(),
    humanDecision: ContentAiHumanDecisionSchema,
    createdBy: ContentAiIdSchema,
    approvedBy: ContentAiIdSchema.nullable(),
    expectedVersion: z.number().int().positive(),
    conflict: ContentAiOperationConflictSchema.nullable(),
  })
  .superRefine((operation, context) => {
    isContentAiSecretSafe(operation, context);
    const needsReviewer =
      operation.humanDecision === "approved" || operation.humanDecision === "corrected";
    if (needsReviewer && operation.approvedBy === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approvedBy"],
        message: "An approved or corrected operation requires an explicit human approver",
      });
    }
    if (!needsReviewer && operation.approvedBy !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approvedBy"],
        message: "Only an approved or corrected operation may carry an approver",
      });
    }
    if (operation.action === "mark_missing_information" && operation.after !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["after"],
        message: "A missing-information operation must leave the proposed value empty",
      });
    }
    if (
      isContentAiHighRiskField(operation.fieldType) &&
      operation.after !== null &&
      !hasContentAiOperationRequiredEvidence(operation)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sources"],
        message: "A high-risk fact cannot receive a proposed value without qualifying evidence",
      });
    }
  });

export const ContentAiSessionSchema = z
  .object({
    id: ContentAiIdSchema,
    ownerId: ContentAiIdSchema,
    createdAt: ContentAiDateTimeSchema,
    updatedAt: ContentAiDateTimeSchema,
    retentionExpiresAt: ContentAiDateTimeSchema,
  })
  .superRefine(isContentAiSecretSafe);

export const ContentAiMessageSchema = z
  .object({
    id: ContentAiIdSchema,
    sessionId: ContentAiIdSchema,
    author: z.enum(["human", "assistant", "system"]),
    body: ContentAiSafeTextSchema,
    createdAt: ContentAiDateTimeSchema,
  })
  .superRefine(isContentAiSecretSafe);

export const ContentAiChangeSetSchema = z
  .object({
    id: ContentAiIdSchema,
    sessionId: ContentAiIdSchema.nullable(),
    createdBy: ContentAiIdSchema,
    targetRoute: ContentAiTargetRouteSchema,
    status: ContentAiBusinessStatusSchema,
    processingState: ContentAiProcessingStateSchema,
    lastErrorCode: z.string().trim().min(1).max(100).nullable(),
    operations: z.array(ContentAiDraftOperationSchema).min(1).max(50),
    createdAt: ContentAiDateTimeSchema,
    updatedAt: ContentAiDateTimeSchema,
  })
  .superRefine((changeSet, context) => {
    isContentAiSecretSafe(changeSet, context);
    if (changeSet.processingState !== "failed" && changeSet.lastErrorCode !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastErrorCode"],
        message: "Only a failed processing state may carry an error code",
      });
    }
    if (changeSet.processingState === "failed" && changeSet.lastErrorCode === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastErrorCode"],
        message: "A failed processing state requires a safe error code",
      });
    }
  });

export const ContentAiReviewDecisionSchema = z
  .object({
    id: ContentAiIdSchema,
    changeSetId: ContentAiIdSchema,
    operationId: ContentAiIdSchema.nullable(),
    decision: z.enum(["approved", "rejected", "corrected", "cancelled", "rebase_requested"]),
    decidedBy: ContentAiIdSchema,
    reason: ContentAiSummarySchema.nullable(),
    createdAt: ContentAiDateTimeSchema,
  })
  .superRefine(isContentAiSecretSafe);

export const ContentAiPublicationResultSchema = z.object({
  changeSetId: ContentAiIdSchema,
  status: z.enum(["published", "conflict", "rejected", "unavailable"]),
  publishedAt: ContentAiDateTimeSchema.nullable(),
  conflicts: z.array(ContentAiOperationConflictSchema),
  message: z.string().trim().min(1).max(240),
});

export type ContentAiBusinessStatus = z.infer<typeof ContentAiBusinessStatusSchema>;
export type ContentAiProcessingState = z.infer<typeof ContentAiProcessingStateSchema>;
export type ContentAiTargetRoute = z.infer<typeof ContentAiTargetRouteSchema>;
export type ContentAiTargetType = z.infer<typeof ContentAiTargetTypeSchema>;
export type ContentAiOperationAction = z.infer<typeof ContentAiOperationActionSchema>;
export type ContentAiRiskLevel = z.infer<typeof ContentAiRiskLevelSchema>;
export type ContentAiHumanDecision = z.infer<typeof ContentAiHumanDecisionSchema>;
export type ContentAiOperationConflict = z.infer<typeof ContentAiOperationConflictSchema>;
export type ContentAiSource = z.infer<typeof ContentAiSourceSchema>;
export type ContentAiDraftOperation = z.infer<typeof ContentAiDraftOperationSchema>;
export type ContentAiSession = z.infer<typeof ContentAiSessionSchema>;
export type ContentAiMessage = z.infer<typeof ContentAiMessageSchema>;
export type ContentAiChangeSet = z.infer<typeof ContentAiChangeSetSchema>;
export type ContentAiReviewDecision = z.infer<typeof ContentAiReviewDecisionSchema>;
export type ContentAiPublicationResult = z.infer<typeof ContentAiPublicationResultSchema>;

const CONTENT_AI_TRANSITIONS: Readonly<
  Record<ContentAiBusinessStatus, readonly ContentAiBusinessStatus[]>
> = {
  draft: ["needs_input", "in_review", "cancelled"],
  needs_input: ["draft", "cancelled"],
  in_review: ["needs_input", "approved", "rejected", "cancelled"],
  approved: ["in_review", "published", "cancelled"],
  published: [],
  rejected: [],
  cancelled: [],
};

const HIGH_RISK_FIELD_TYPES = new Set([
  "local_name_zh",
  "local_address_zh",
  "local_address_district",
  "local_address_nearest_metro_exit",
  "local_address_visibility_note",
  "hours",
  "ticket_price",
  "booking_required",
  "passport_requirement",
  "payment_acceptance",
  "foreign_card_support",
  "medical_information",
  "safety_information",
  "commercial_information",
]);

const SOURCE_PRECEDENCE: Readonly<Record<PoiFactSourceClass, number>> = {
  operator_verified: 5,
  official: 4,
  reputable_editorial: 3,
  user_report: 2,
  uncorroborated_scrape: 1,
  model_output: 0,
};

export function isContentAiChangeSetTransitionValid(
  from: ContentAiBusinessStatus,
  to: ContentAiBusinessStatus,
): boolean {
  return CONTENT_AI_TRANSITIONS[from].includes(to);
}

export function isContentAiHighRiskField(fieldType: string): boolean {
  return HIGH_RISK_FIELD_TYPES.has(fieldType);
}

export function hasContentAiOperationRequiredEvidence(
  operation: Pick<ContentAiDraftOperation, "sources">,
): boolean {
  return operation.sources.some(
    (source) =>
      source.sourceClass === "official" ||
      source.sourceClass === "operator_verified" ||
      source.sourceClass === "reputable_editorial",
  );
}

export function contentAiSourcePrecedence(input: {
  sourceClass: PoiFactSourceClass;
  verificationState?: ContentAiSource["verificationState"];
  expiresAt?: string | null;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  if (input.verificationState === "rejected" || input.verificationState === "historical") return 0;
  if (
    input.expiresAt !== undefined &&
    input.expiresAt !== null &&
    Date.parse(input.expiresAt) < now.getTime()
  ) {
    return 0;
  }
  if (input.sourceClass === "operator_verified" && input.verificationState !== "reviewed") {
    return 0;
  }
  return SOURCE_PRECEDENCE[input.sourceClass];
}

export function canContentAiOperationOverwrite(input: {
  currentFact: PoiFact | null;
  proposedSourceClass: PoiFactSourceClass;
  initiatedBy: "ai" | "human";
  now?: Date;
}): {
  allowed: boolean;
  reason:
    | "no_current_fact"
    | "reviewed_fact_requires_human_review"
    | "source_precedence"
    | "human_review_required";
} {
  const now = input.now ?? new Date();
  if (input.currentFact === null) return { allowed: true, reason: "no_current_fact" };
  if (input.initiatedBy === "ai" && isEligiblePoiFact(input.currentFact, now)) {
    return { allowed: false, reason: "reviewed_fact_requires_human_review" };
  }
  const currentPrecedence = contentAiSourcePrecedence({
    sourceClass: input.currentFact.sourceClass ?? "model_output",
    verificationState: input.currentFact.status === "reviewed" ? "reviewed" : "draft",
    expiresAt: input.currentFact.expiresAt,
    now,
  });
  if (
    contentAiSourcePrecedence({ sourceClass: input.proposedSourceClass, now }) < currentPrecedence
  ) {
    return { allowed: false, reason: "source_precedence" };
  }
  return { allowed: false, reason: "human_review_required" };
}

export function deriveContentAiOperationDiff(
  operation: Pick<ContentAiDraftOperation, "before" | "after">,
): { status: "unchanged" | "changed" | "missing"; before: unknown | null; after: unknown | null } {
  if (operation.after === null) return { status: "missing", before: operation.before, after: null };
  if (JSON.stringify(operation.before) === JSON.stringify(operation.after)) {
    return { status: "unchanged", before: operation.before, after: operation.after };
  }
  return { status: "changed", before: operation.before, after: operation.after };
}

export function explainContentAiVersionConflict(input: {
  expectedVersion: number;
  currentVersion: number | null;
}): ContentAiOperationConflict | null {
  if (input.currentVersion === input.expectedVersion) return null;
  return ContentAiOperationConflictSchema.parse({
    code: input.currentVersion === null ? "target_missing" : "stale_version",
    expectedVersion: input.expectedVersion,
    currentVersion: input.currentVersion,
    message:
      input.currentVersion === null
        ? "The target is no longer available. Refresh before deciding how to proceed."
        : "The target changed after this draft was prepared. Rebase before publishing.",
  });
}

export function canPublishContentAiChangeSet(changeSet: ContentAiChangeSet): boolean {
  return (
    changeSet.status === "approved" &&
    changeSet.processingState === "idle" &&
    changeSet.operations.length > 0 &&
    changeSet.operations.every(
      (operation) =>
        operation.conflict === null &&
        (operation.humanDecision === "approved" || operation.humanDecision === "corrected") &&
        (!isContentAiHighRiskField(operation.fieldType) ||
          operation.after === null ||
          hasContentAiOperationRequiredEvidence(operation)),
    )
  );
}

export function parseContentAiChangeSet(input: unknown): ContentAiChangeSet {
  rejectContentAiSensitiveRecord(input);
  return ContentAiChangeSetSchema.parse(input);
}

export function parseContentAiSource(input: unknown): ContentAiSource {
  rejectContentAiSensitiveRecord(input);
  return ContentAiSourceSchema.parse(input);
}

// This export keeps the established fact evidence shape discoverable to Change Set consumers
// without inventing a second source/evidence enum for Content AI.
export const ContentAiFactEvidenceSchema = PoiFactEvidenceSchema;
