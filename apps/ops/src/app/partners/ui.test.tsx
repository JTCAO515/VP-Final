import type { Partner } from "@visepanda/domain";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PartnerConfigurationCard } from "./ui";

const partner: Partner = {
  key: "safe_partner",
  hosts: ["safe.example.com"],
  categories: ["hotel"],
  cities: ["Shanghai"],
  trackingParam: "vp_click_id",
  kind: "ota",
  status: "pending",
};

describe("PartnerConfigurationCard", () => {
  it("renders pending configuration as non-clickable preview with an explicit activation action", () => {
    const html = renderToStaticMarkup(
      <PartnerConfigurationCard
        disabled={false}
        onEdit={() => undefined}
        onStatusChange={() => undefined}
        partner={partner}
      />,
    );
    expect(html).toContain("仅供预览。不会产生跳转或点击。");
    expect(html).toContain("启用…");
    expect(html).not.toMatch(/<a(?:\s|>)/);
    expect(html).not.toContain("https://");
  });

  it("distinguishes active and inactive status without inventing approval or revenue", () => {
    const html = renderToStaticMarkup(
      <PartnerConfigurationCard
        disabled={false}
        onEdit={() => undefined}
        onStatusChange={() => undefined}
        partner={{ ...partner, status: "active" }}
      />,
    );
    expect(html).toContain("active");
    expect(html).toContain("设为停用");
    expect(html).not.toContain("approved");
    expect(html).not.toContain("commission");
    expect(html).not.toContain("revenue");
  });

  it("labels a creator as an acquisition source without an outbound claim", () => {
    const html = renderToStaticMarkup(
      <PartnerConfigurationCard
        disabled={false}
        onEdit={() => undefined}
        onStatusChange={() => undefined}
        partner={{ ...partner, kind: "creator" }}
      />,
    );
    expect(html).toContain("内容创作者获客来源");
    expect(html).toContain("不能跳转，也不会产生外跳点击");
    expect(html).not.toMatch(/<a(?:\s|>)/);
  });
});
