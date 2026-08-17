import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import type { CopilotCostSummary } from "@visepanda/app-server";
import { CostSummaryView } from "./ui";

const summary: CopilotCostSummary = {
  fromDay: "2026-07-13",
  throughDay: "2026-07-26",
  daily: [
    {
      day: "2026-07-26",
      callCount: 2,
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 40,
      costUsd: "0.01000000",
      fallbackRate: "0.5",
      cacheHitRate: "0.16666667",
    },
  ],
  byModel: [
    {
      provider: "moonshot",
      model: "kimi-k2.6",
      effort: "medium",
      callCount: 2,
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 40,
      costUsd: "0.01000000",
      fallbackRate: "0.5",
      cacheHitRate: "0.16666667",
    },
  ],
  topIdentities: [
    {
      identityKind: "authenticated",
      identityRef: "user-7609b34ec129",
      callCount: 2,
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 40,
      costUsd: "0.01000000",
      fallbackRate: "0.5",
      cacheHitRate: "0.16666667",
    },
  ],
  reconciliation: {
    unpricedCallCount: 1,
    affectedModelCount: 1,
    oldestUnpricedAt: "2026-07-26T10:00:00.000Z",
  },
};

describe("CostSummaryView", () => {
  it("renders retained aggregates, private references, and an honest unset budget", () => {
    const html = renderToStaticMarkup(
      <CostSummaryView budgetError={null} budgetUsd={null} summary={summary} />,
    );

    expect(html).toContain("成本汇总");
    expect(html).toContain("kimi-k2.6");
    expect(html).toContain("user-7609b34ec129");
    expect(html).toContain("未配置");
    expect(html).toContain("1 次调用需要复核");
    expect(html).not.toContain("access_token");
    expect(html).not.toContain("provider key");
  });

  it("renders truthful empty states instead of zero-cost sample rows", () => {
    const html = renderToStaticMarkup(
      <CostSummaryView
        budgetError={null}
        budgetUsd="5.00000000"
        summary={{
          ...summary,
          daily: [],
          byModel: [],
          topIdentities: [],
          reconciliation: {
            unpricedCallCount: 0,
            affectedModelCount: 0,
            oldestUnpricedAt: null,
          },
        }}
      />,
    );

    expect(html).toContain("此时间窗口内没有保留的调用记录。");
    expect(html).toContain("此时间窗口内没有模型汇总。");
    expect(html).toContain("此时间窗口内没有身份汇总。");
    expect(html).toContain("没有未定价的保留调用");
    expect(html).toContain("$5.00 观察阈值");
  });
});
