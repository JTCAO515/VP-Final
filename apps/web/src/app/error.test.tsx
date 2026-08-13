import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WebErrorFallback } from "./error";

describe("WebErrorFallback", () => {
  it("renders a recovery state and safe correlation id without error diagnostics", () => {
    const html = renderWithReact(
      React.createElement(WebErrorFallback, {
        correlationId: "4e63db44-0ac0-4751-a045-e9c9fe96dc85",
        reset: () => undefined,
      }),
    );

    expect(html).toContain("We could not finish that page.");
    expect(html).toContain("4e63db44-0ac0-4751-a045-e9c9fe96dc85");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("provider payload");
    expect(html).not.toContain("secret token");
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
