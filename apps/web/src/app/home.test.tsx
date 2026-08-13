import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeShell } from "./home";

describe("public VisePanda home", () => {
  it("keeps the landing page as a product preview and sends the main action to the workspace", () => {
    const html = renderWithReact(React.createElement(HomeShell));

    expect(html).toContain("China, handled.");
    expect(html).toContain("Illustrative arrival example");
    expect(html).toContain("Not live trip data");
    expect(html).toContain('href="/visepanda"');
    expect(html).toContain("Start with VisePanda");
    expect(html).not.toContain('aria-label="Trip prompt"');
    expect(html).not.toContain("Ask VisePanda</button>");
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
