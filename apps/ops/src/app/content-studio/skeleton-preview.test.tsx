import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentAiWalkingSkeletonPreview } from "./skeleton-preview";

const draft = {
  id: "00000000-0000-4000-8000-000000000001",
  ownerId: "00000000-0000-4000-8000-000000000002",
  poiId: "00000000-0000-4000-8000-000000000003",
  factId: "00000000-0000-4000-8000-000000000004",
  factType: "local_address_nearest_metro_exit" as const,
  before: null,
  after: { text: "1 号口" },
  evidence: {
    sourceClass: "operator_verified" as const,
    sourceLocator: "ops://fixture",
    evidenceSummary: "Fixture observation.",
  },
  riskLevel: "execution" as const,
  expectedFactVersion: 1,
  state: "conflict" as const,
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
};

describe("Content AI walking skeleton preview", () => {
  it("shows the exact diff, evidence, risk and rebase-needed state", () => {
    const html = renderToStaticMarkup(<ContentAiWalkingSkeletonPreview draft={draft} />);
    expect(html).toContain("最近地铁出口");
    expect(html).toContain("1 号口");
    expect(html).toContain("Fixture observation.");
    expect(html).toContain("需要重新核对");
  });
});
