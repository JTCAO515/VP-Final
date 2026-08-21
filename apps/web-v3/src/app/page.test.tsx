import * as React from "react";
import { EARLY_ACCESS_PRIMARY_CONCERNS } from "@visepanda/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LANDING_CONCERN_ORDER, landingCopyFor } from "../i18n/landing-copy";
import { formStatusMessage } from "./_components/early-access-form";
import Page from "./page";

describe("VP-V3 Early Access shell", () => {
  it("renders one acquisition action and an explicitly static product preview", () => {
    const html = renderWithReact(React.createElement(Page));

    expect(html).toContain("Plan your China trip with AI. Then work through it with confidence.");
    expect(html).toContain("Get free early access");
    expect(html).toContain('name="primaryConcern"');
    expect(html).toContain("Product preview");
    expect(html).toContain("Static product preview. No booking or payment is taking place.");
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    expect(html).toContain('action="/api/early-access"');
    expect(html).toContain('method="post"');
    expect(html).toContain('type="submit" disabled=""');
    expect(html).not.toContain("Add item");
    expect(html).not.toContain("Ask anything");
    expect(html).not.toContain('href="/plan"');
  });

  it("keeps every locale complete and concern values aligned to Domain", () => {
    expect(LANDING_CONCERN_ORDER).toEqual(EARLY_ACCESS_PRIMARY_CONCERNS);
    for (const locale of ["en", "zh-CN", "es", "ar", "ru"] as const) {
      const copy = landingCopyFor(locale);
      expect(copy.title).not.toBe("");
      expect(copy.form.submit).not.toBe("");
      expect(copy.preview.blockTitles).toHaveLength(4);
      expect(copy.scenarios).toHaveLength(3);
      expect(copy.faqs).toHaveLength(2);
      expect(Object.keys(copy.concerns)).toHaveLength(10);
    }
  });

  it("renders the honest unavailable state for a missing shared runtime", () => {
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
