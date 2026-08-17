import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DraftFactReviewQueueItem, Poi } from "@visepanda/domain";
import { DraftFactReviewCard, FactEditor, FactExpiryDashboard } from "./ui";

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

const expiryPoi: Poi = {
  id: "30000000-0000-0000-0000-000000000001",
  city: "Shanghai",
  category: "attraction",
  nameEn: "Yu Garden",
  sourceIds: {},
  commercialLinks: [],
  facts: [
    {
      id: "30000000-0000-0000-0000-000000000004",
      poiId: "30000000-0000-0000-0000-000000000001",
      factType: "payment_acceptance",
      value: { label: "Foreign cards accepted" },
      confidence: 0.9,
      source: "https://example.com/payment",
      sourceClass: "official",
      sourceLocator: "https://example.com/payment",
      evidenceSummary: "The official page confirms payment acceptance.",
      ingestedAt: "2026-08-01T00:00:00.000Z",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-08-30T00:00:00.000Z",
      reviewPolicy: "volatile-30d-v1",
      version: 2,
      status: "reviewed",
    },
    {
      id: "30000000-0000-0000-0000-000000000005",
      poiId: "30000000-0000-0000-0000-000000000001",
      factType: "hours",
      value: { label: "Open daily" },
      confidence: 0.9,
      source: "https://example.com/hours",
      sourceClass: "official",
      sourceLocator: "https://example.com/hours",
      evidenceSummary: "The official page confirms opening hours.",
      ingestedAt: "2026-07-01T00:00:00.000Z",
      verifiedAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2026-07-31T00:00:00.000Z",
      reviewPolicy: "volatile-30d-v1",
      version: 2,
      status: "reviewed",
    },
  ],
};

describe("FactEditor local-display authoring", () => {
  it("renders a private image form without a public media claim", () => {
    const html = renderToStaticMarkup(<FactEditor />);

    expect(html).toContain("地点图片库");
    expect(html).toContain("保存私有图片");
    expect(html).toContain("转换为不含 EXIF 的 WebP");
    expect(html).not.toContain("Public image URL");
  });

  it("renders the dedicated draft-only Show-to-Local form and address safety warning boundary", () => {
    const html = renderToStaticMarkup(<FactEditor />);

    expect(html).toContain("向本地人展示的事实");
    expect(html).toContain("事实草稿审核队列");
    expect(html).toContain("每条本地展示事实都从草稿开始");
    expect(html).toContain("保存本地展示草稿");
    expect(html).toContain("文本（最多 500 个字符）");
    expect(html).toContain("来源 URL 或证据引用");
    expect(html).toContain("证据摘要（不含个人联系方式）");
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

    expect(html).toContain("确认批准");
    expect(html).toContain("此中文地址可能会展示给真实的陌生人。");
    expect(html).not.toContain("Approve all");
    expect(html).not.toContain("bulk");
  });

  it("distinguishes expired and near-expiry reviewed facts with individual lifecycle actions", () => {
    const html = renderToStaticMarkup(
      <FactExpiryDashboard
        initialExpiredFactIds={["30000000-0000-0000-0000-000000000005"]}
        now={() => new Date("2026-08-16T00:00:00.000Z")}
        onChanged={async () => undefined}
        pois={[expiryPoi]}
      />,
    );

    expect(html).toContain("已过期事实");
    expect(html).toContain("30 天内到期");
    expect(html).toContain("易变信息 · 30 天策略");
    expect(html).toContain("续期此事实");
    expect(html).toContain("废弃此事实");
    expect(html).not.toContain("Approve all");
  });
});
