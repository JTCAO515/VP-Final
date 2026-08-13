import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter, SiteHeader } from "./site-chrome";

describe("shared site chrome", () => {
  it("keeps the four primary product surfaces, account, and skip target reachable", () => {
    const html = renderWithReact(React.createElement(SiteHeader, { active: "guides" }));

    expect(html).toContain('href="#page-content"');
    expect(html).toContain('id="page-content"');
    expect(html).toContain('aria-label="Primary navigation"');
    for (const href of [
      "/visepanda",
      "/explore",
      "/guides/payment",
      "/rescue",
      "/human-help",
      "/account",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('aria-current="page" href="/guides/payment"');
    expect(html).toContain(">VisePanda<");
  });

  it("keeps product and trust destinations grouped in the shared footer", () => {
    const html = renderWithReact(React.createElement(SiteFooter));

    expect(html).toContain('aria-label="Product links"');
    expect(html).toContain('aria-label="Trust and legal links"');
    for (const href of [
      "/visepanda",
      "/explore",
      "/guides/payment",
      "/rescue",
      "/human-help",
      "/account",
      "/privacy",
      "/terms",
      "/affiliate-disclosure",
      "/human-help-disclaimer",
      "/emergency-disclaimer",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
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
