import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DraftFactReviewQueueItem } from "@visepanda/domain";
import { DraftFactReviewCard, FactEditor } from "./ui";

const reviewItem: DraftFactReviewQueueItem = {
  poi: {
    id: "30000000-0000-4000-8000-000000000001",
    city: "Shanghai",
    category: "attraction",
    nameEn: "Yu Garden",
    nameZh: "豫园",
  },
  draft: {
    id: "30000000-0000-4000-8000-000000000002",
    poiId: "30000000-0000-4000-8000-000000000001",
    factType: "local_address_zh",
    value: { text: "上海市黄浦区豫园路279号" },
    confidence: 0.9,
    source: "https://example.com/official-address",
    sourceClass: "official",
    sourceLocator: "https://example.com/official-address",
    evidenceSummary: "The official source publishes this Chinese address.",
    ingestedAt: "2026-08-16T00:00:00.000Z",
    verifiedAt: null,
    expiresAt: null,
    reviewPolicy: null,
    version: 3,
    status: "draft",
  },
  importContext: {
    collectionRowId: "row-1",
    collectionStatus: "researched",
    importBatchId: "30000000-0000-4000-8000-000000000003",
    evidenceReviewedAt: null,
  },
  reviewedSiblings: [],
};

describe("FactEditor local-display authoring", () => {
  it("renders the dedicated draft-only Show-to-Local form and address safety warning boundary", () => {
    const html = renderToStaticMarkup(<FactEditor />);

    expect(html).toContain("Show-to-Local facts");
    expect(html).toContain("Draft fact review queue");
    expect(html).toContain("Each local-display fact starts as a draft");
    expect(html).toContain("Save local-display draft");
    expect(html).toContain("Text (maximum 500 characters)");
    expect(html).toContain("Source URL or evidence reference");
    expect(html).toContain("Evidence summary (no personal contact details)");
    expect(html).not.toContain("verifiedAt");
    expect(html).not.toContain("Approve all");
    expect(html).not.toContain("Mark reviewed");
    expect(html).not.toContain("Select all");
  });

  it("renders a second visible confirmation for one draft rather than a bulk approval control", () => {
    const html = renderToStaticMarkup(
      <DraftFactReviewCard
        actionPending="approve"
        busy={false}
        item={reviewItem}
        onCancelAction={() => undefined}
        onConfirmAction={() => undefined}
        onProposeAction={() => undefined}
        onSaveCorrection={async () => true}
      />,
    );

    expect(html).toContain("Confirm approval");
    expect(html).toContain("Confirm approve");
    expect(html).toContain("This Chinese address may be shown to a real stranger.");
    expect(html).not.toContain("Approve all");
    expect(html).not.toContain("bulk");
  });
});
