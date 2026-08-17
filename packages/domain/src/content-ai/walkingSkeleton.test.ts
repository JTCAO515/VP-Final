import { describe, expect, it } from "vitest";
import {
  ContentAiWalkingSkeletonDraftSchema,
  canReadContentAiWalkingSkeletonDraft,
  isContentAiWalkingSkeletonPublishable,
} from "./walkingSkeleton.js";

const draft = {
  id: "00000000-0000-4000-8000-000000000001",
  ownerId: "00000000-0000-4000-8000-000000000002",
  poiId: "00000000-0000-4000-8000-000000000003",
  factId: "00000000-0000-4000-8000-000000000004",
  factType: "local_address_nearest_metro_exit",
  before: null,
  after: { text: "Exit 1" },
  evidence: {
    sourceClass: "operator_verified",
    sourceLocator: "ops://walking-skeleton-fixture",
    evidenceSummary: "Fixture-only observation for transaction verification.",
  },
  riskLevel: "execution",
  expectedFactVersion: 1,
  state: "draft",
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
} as const;

describe("Content AI walking skeleton contract", () => {
  it("accepts precisely one local presentation field", () => {
    expect(ContentAiWalkingSkeletonDraftSchema.parse(draft).factType).toBe(
      "local_address_nearest_metro_exit",
    );
    expect(
      ContentAiWalkingSkeletonDraftSchema.safeParse({ ...draft, factType: "hours" }).success,
    ).toBe(false);
  });

  it("keeps owner visibility private while allowing an authorized reviewer", () => {
    expect(
      canReadContentAiWalkingSkeletonDraft({
        ownerId: draft.ownerId,
        requesterId: draft.ownerId,
        canReview: false,
      }),
    ).toBe(true);
    expect(
      canReadContentAiWalkingSkeletonDraft({
        ownerId: draft.ownerId,
        requesterId: "00000000-0000-4000-8000-000000000099",
        canReview: false,
      }),
    ).toBe(false);
    expect(
      canReadContentAiWalkingSkeletonDraft({
        ownerId: draft.ownerId,
        requesterId: "00000000-0000-4000-8000-000000000099",
        canReview: true,
      }),
    ).toBe(true);
  });

  it("only permits publishing a current draft", () => {
    expect(isContentAiWalkingSkeletonPublishable(draft)).toBe(true);
    expect(isContentAiWalkingSkeletonPublishable({ state: "conflict" })).toBe(false);
  });
});
