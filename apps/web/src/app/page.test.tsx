import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Early Access root placeholder", () => {
  it("does not render the product home before the Landing UI is ready", () => {
    const html = renderWithReact(React.createElement(Page));

    expect(html).toContain("Early access is opening soon.");
    expect(html).not.toContain("Start with VisePanda");
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
