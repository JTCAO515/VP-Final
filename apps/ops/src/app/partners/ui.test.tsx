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
    expect(html).toContain("Preview only. No redirect or click can be produced.");
    expect(html).toContain("Activate…");
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
    expect(html).toContain("Set inactive");
    expect(html).not.toContain("approved");
    expect(html).not.toContain("commission");
    expect(html).not.toContain("revenue");
  });
});
