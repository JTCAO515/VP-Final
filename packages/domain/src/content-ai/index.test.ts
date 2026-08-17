import { describe, expect, it } from "vitest";
import {
  ContentAiChangeSetSchema,
  ContentAiDraftOperationSchema,
  ContentAiMessageSchema,
  canContentAiOperationOverwrite,
  canPublishContentAiChangeSet,
  contentAiSourcePrecedence,
  deriveContentAiOperationDiff,
  explainContentAiVersionConflict,
  isContentAiChangeSetTransitionValid,
  parseContentAiChangeSet,
} from "./index.js";

const ids = {
  changeSet: "71000000-0000-4000-8000-000000000001",
  session: "71000000-0000-4000-8000-000000000002",
  operation: "71000000-0000-4000-8000-000000000003",
  poi: "71000000-0000-4000-8000-000000000004",
  creator: "71000000-0000-4000-8000-000000000005",
  reviewer: "71000000-0000-4000-8000-000000000006",
  source: "71000000-0000-4000-8000-000000000007",
  fact: "71000000-0000-4000-8000-000000000008",
};

const source = {
  id: ids.source,
  sourceClass: "operator_verified",
  sourceLocator: "ops://content-ai-domain-fixture",
  evidenceSummary: "Fixture-only operator observation for domain contract tests.",
  observedAt: "2026-08-17T00:00:00.000Z",
  retrievedAt: null,
  verifiedAt: "2026-08-17T00:00:00.000Z",
  expiresAt: "2026-11-15T00:00:00.000Z",
  verificationState: "reviewed",
} as const;

const operation = {
  id: ids.operation,
  targetRoute: "supabase_content_draft",
  targetType: "poi_fact",
  targetEntityId: ids.fact,
  action: "update",
  fieldType: "local_address_nearest_metro_exit",
  before: { text: "Exit 2" },
  after: { text: "Exit 1" },
  sources: [source],
  riskLevel: "execution",
  aiConfidence: 0.8,
  humanDecision: "approved",
  createdBy: ids.creator,
  approvedBy: ids.reviewer,
  expectedVersion: 3,
  conflict: null,
} as const;

function changeSet(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.changeSet,
    sessionId: ids.session,
    createdBy: ids.creator,
    targetRoute: "supabase_content_draft",
    status: "approved",
    processingState: "idle",
    lastErrorCode: null,
    operations: [operation],
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("Content AI Change Set domain contract", () => {
  it("separates legal business transitions from runtime processing", () => {
    expect(isContentAiChangeSetTransitionValid("draft", "in_review")).toBe(true);
    expect(isContentAiChangeSetTransitionValid("draft", "published")).toBe(false);
    expect(isContentAiChangeSetTransitionValid("published", "draft")).toBe(false);
    expect(ContentAiChangeSetSchema.parse(changeSet()).processingState).toBe("idle");
  });

  it("does not let AI overwrite a current reviewed operator fact", () => {
    const currentFact = {
      id: ids.fact,
      poiId: ids.poi,
      factType: "local_address_nearest_metro_exit",
      value: { text: "Exit 2" },
      confidence: 0.95,
      source: source.sourceLocator,
      sourceClass: "operator_verified",
      sourceLocator: source.sourceLocator,
      evidenceSummary: source.evidenceSummary,
      ingestedAt: "2026-08-17T00:00:00.000Z",
      verifiedAt: "2026-08-17T00:00:00.000Z",
      expiresAt: "2026-11-15T00:00:00.000Z",
      reviewPolicy: "execution-90d-v1",
      version: 3,
      status: "reviewed",
    } as const;

    expect(
      canContentAiOperationOverwrite({
        currentFact,
        proposedSourceClass: "official",
        initiatedBy: "ai",
        now: new Date("2026-08-18T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: false, reason: "reviewed_fact_requires_human_review" });
  });

  it("rejects a source-less high-risk proposed value while allowing missing-information state", () => {
    expect(ContentAiDraftOperationSchema.safeParse({ ...operation, sources: [] }).success).toBe(
      false,
    );
    expect(
      ContentAiDraftOperationSchema.safeParse({
        ...operation,
        action: "mark_missing_information",
        after: null,
        sources: [],
        humanDecision: "pending",
        approvedBy: null,
      }).success,
    ).toBe(true);
  });

  it("blocks publication when an operation has a stale version", () => {
    const conflict = explainContentAiVersionConflict({ expectedVersion: 3, currentVersion: 4 });
    expect(conflict).toMatchObject({
      code: "stale_version",
      expectedVersion: 3,
      currentVersion: 4,
    });
    const parsed = ContentAiChangeSetSchema.parse(
      changeSet({ operations: [{ ...operation, conflict }] }),
    );
    expect(canPublishContentAiChangeSet(parsed)).toBe(false);
  });

  it("computes a UI-safe before and after projection without publishing it", () => {
    expect(deriveContentAiOperationDiff(operation)).toMatchObject({
      status: "changed",
      before: { text: "Exit 2" },
      after: { text: "Exit 1" },
    });
    expect(deriveContentAiOperationDiff({ before: { text: "Exit 1" }, after: null }).status).toBe(
      "missing",
    );
  });

  it("rejects credentials, cookies, signatures, and database URLs from messages and operations", () => {
    expect(
      ContentAiMessageSchema.safeParse({
        id: ids.operation,
        sessionId: ids.session,
        author: "human",
        body: "postgresql://not-allowed.example/db",
        createdAt: "2026-08-17T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      ContentAiDraftOperationSchema.safeParse({
        ...operation,
        after: { cookie: "not-allowed" },
      }).success,
    ).toBe(false);
    expect(() =>
      parseContentAiChangeSet(
        changeSet({ operations: [{ ...operation, after: { signature: "x" } }] }),
      ),
    ).toThrow(/sensitive_key/);
  });

  it("makes expired and model-authored sources non-preferred", () => {
    expect(
      contentAiSourcePrecedence({
        sourceClass: "operator_verified",
        expiresAt: "2026-08-16T00:00:00.000Z",
        now: new Date("2026-08-17T00:00:00.000Z"),
      }),
    ).toBe(0);
    expect(
      contentAiSourcePrecedence({
        sourceClass: "operator_verified",
        verificationState: "draft",
      }),
    ).toBe(0);
    expect(contentAiSourcePrecedence({ sourceClass: "model_output" })).toBe(0);
    expect(contentAiSourcePrecedence({ sourceClass: "official" })).toBeGreaterThan(
      contentAiSourcePrecedence({ sourceClass: "user_report" }),
    );
  });
});
