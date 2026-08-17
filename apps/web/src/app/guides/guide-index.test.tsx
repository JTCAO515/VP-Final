import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../i18n/locale-provider";
import { GuideIndex } from "./guide-index";
import { GUIDES } from "./data";

describe("guides index", () => {
  it("links only to the existing guide routes", () => {
    const html = renderWithReact(
      React.createElement(LocaleProvider, {
        initialLocale: "en",
        children: React.createElement(GuideIndex, { guides: GUIDES }),
      }),
    );

    for (const guide of GUIDES) {
      expect(html).toContain(`href="/guides/${guide.slug}"`);
      expect(html).toContain(guide.title);
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
