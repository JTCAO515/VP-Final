import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../i18n/locale-provider";
import { SiteFooter, SiteHeader } from "./site-chrome";

describe("shared site chrome", () => {
  it("keeps the four primary product surfaces, account, and skip target reachable", () => {
    const html = renderWithReact(React.createElement(SiteHeader, { active: "guides" }));

    expect(html).toContain('class="skipLink"');
    expect(html).toContain('href="#page-content"');
    expect(html).toContain('id="page-content"');
    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('class="siteContext"');
    for (const href of [
      "/visepanda",
      "/explore",
      "/guides",
      "/rescue",
      "/human-help",
      "/account",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('aria-current="page" href="/guides"');
    expect(html).toContain(">VisePanda<");
    expect(html).toContain('class="brandMark" href="/homepage"');
  });

  it("keeps product and trust destinations grouped in the shared footer", () => {
    const html = renderWithReact(React.createElement(SiteFooter));

    expect(html).toContain('aria-label="Product links"');
    expect(html).toContain('aria-label="Trust and legal links"');
    expect(html).toContain('class="brandMark" href="/homepage"');
    for (const href of [
      "/visepanda",
      "/arrival-pack",
      "/explore",
      "/guides",
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

  it("renders shared navigation from the selected UI locale without changing destinations", () => {
    const html = renderWithReact(
      React.createElement(LocaleProvider, {
        initialLocale: "ar",
        children: React.createElement(SiteHeader, { active: "copilot" }),
      }),
    );

    expect(html).toContain(">استكشاف<");
    expect(html).toContain(">العربية<");
    expect(html).toContain('href="/visepanda"');
    expect(html).toContain('aria-label="اللغة"');
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
