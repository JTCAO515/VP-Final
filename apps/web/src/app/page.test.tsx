import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EARLY_ACCESS_PRIMARY_CONCERNS } from "@visepanda/domain";
import Page from "./page";
import { LANDING_CONCERN_ORDER, landingCopyFor } from "./_landing/copy";
import { formStatusMessage } from "./_landing/early-access-form";

describe("Early Access landing", () => {
  it("keeps the real signup form as the Landing's only product action", () => {
    const html = renderWithReact(React.createElement(Page));

    expect(html).toContain("Plan your China trip with AI. Then work through it with confidence.");
    expect(html).toContain("Product preview");
    expect(html).toContain("Trip Canvas");
    expect(html).toContain("Static product preview. No booking or payment is taking place.");
    expect(html).toContain("Get free early access");
    expect(html).toContain('name="primaryConcern"');
    expect(html).not.toContain('href="/visepanda"');
    expect(html).not.toContain('href="/homepage"');
    expect(html).not.toContain("How it works");
    expect(html).toContain('type="submit" disabled=""');
  });

  it("provides complete Landing copy in every supported interface locale", () => {
    expect(LANDING_CONCERN_ORDER).toEqual(EARLY_ACCESS_PRIMARY_CONCERNS);
    for (const locale of ["en", "zh-CN", "es", "ar", "ru"] as const) {
      const copy = landingCopyFor(locale);
      expect(copy.title).not.toEqual("");
      expect(copy.form.submit).not.toEqual("");
      expect(copy.scenarios).toHaveLength(3);
      expect(copy.faqs).toHaveLength(2);
      expect(Object.keys(copy.concerns)).toHaveLength(10);
    }
  });

  it("derives an existing signup status from the current locale", () => {
    expect(formStatusMessage("error", landingCopyFor("en"))).toContain("temporarily unavailable");
    expect(formStatusMessage("error", landingCopyFor("ar"))).toContain("مؤقتاً");
  });
});

function renderWithReact(element: React.ReactElement) {
  const runtimeGlobal = globalThis as typeof globalThis & { React?: typeof React };
  runtimeGlobal.React = React;
  try {
    return renderToStaticMarkup(element);
  } finally {
    delete runtimeGlobal.React;
  }
}
