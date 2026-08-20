import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Early Access landing", () => {
  it("shows the planning-and-execution workspace preview and a real signup form", () => {
    const html = renderWithReact(React.createElement(Page));

    expect(html).toContain("Plan and execute your independent trip to China with AI.");
    expect(html).toContain("Product Preview");
    expect(html).toContain("Trip Canvas");
    expect(html).toContain("Static product preview. No booking or payment is taking place.");
    expect(html).toContain('href="/visepanda"');
    expect(html).toContain('href="/homepage"');
    expect(html).toContain("Help shape the first supported cities.");
    expect(html).toContain('type="submit" disabled=""');
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
