import { z } from "zod";
import { PoiFactEvidenceSchema, PoiLocalPresentationFactValueSchema } from "../knowledge/index.js";

// This intentionally narrow contract is a vertical-slice probe. CONTENT-AI-02
// replaces it with the general Change Set model after its UI and transaction
// semantics have been observed in a real service path.
export const ContentAiWalkingSkeletonStateSchema = z.enum(["draft", "published", "conflict"]);

export const ContentAiWalkingSkeletonDraftSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  poiId: z.string().uuid(),
  factId: z.string().uuid(),
  factType: z.literal("local_address_nearest_metro_exit"),
  before: PoiLocalPresentationFactValueSchema.nullable(),
  after: PoiLocalPresentationFactValueSchema,
  evidence: PoiFactEvidenceSchema,
  riskLevel: z.literal("execution"),
  expectedFactVersion: z.number().int().positive(),
  state: ContentAiWalkingSkeletonStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ContentAiWalkingSkeletonDraft = z.infer<typeof ContentAiWalkingSkeletonDraftSchema>;

export function canReadContentAiWalkingSkeletonDraft(input: {
  ownerId: string;
  requesterId: string;
  canReview: boolean;
}): boolean {
  return input.ownerId === input.requesterId || input.canReview;
}

export function isContentAiWalkingSkeletonPublishable(
  draft: Pick<ContentAiWalkingSkeletonDraft, "state">,
): boolean {
  return draft.state === "draft";
}
