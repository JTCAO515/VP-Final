import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS } from "./legal-content";
import { LegalPage } from "./legal-page";
import { SiteFooter } from "./site-chrome";

describe("LegalPage", () => {
  it.each(Object.values(LEGAL_DOCUMENTS).map((document) => [document.id, document] as const))(
    "renders the %s document with navigation, effective date, and contact",
    (_id, document) => {
      const html = renderWithReact(React.createElement(LegalPage, { document }));

      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(document.title);
      expect(html).toContain(`aria-label="On this page: ${document.title}"`);
      expect(html).toContain("July 24, 2026");
      expect(html).toContain("mailto:admin@go2china.space");
    },
  );

  it("marks the official emergency source as an external noreferrer link", () => {
    const html = renderWithReact(
      React.createElement(LegalPage, { document: LEGAL_DOCUMENTS.emergency }),
    );

    expect(html).toContain(
      'href="https://english.shanghai.gov.cn/en-EmergencyNumbers/20240104/8eec5a3d2b864187af8f383cc6b94ae5.html"',
    );
    expect(html).toContain('rel="noreferrer"');
  });

  it("keeps every trust document reachable from the shared footer", () => {
    const html = renderWithReact(React.createElement(SiteFooter));

    for (const href of [
      "/privacy",
      "/terms",
      "/affiliate-disclosure",
      "/human-help-disclaimer",
      "/emergency-disclaimer",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('aria-label="Trust and legal links"');
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
