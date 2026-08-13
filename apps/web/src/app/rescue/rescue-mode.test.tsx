import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RescueMode } from "./rescue-mode";

describe("Rescue Mode", () => {
  it("renders fixed problem categories without a Human Help, payment, or medical-service promise", () => {
    const html = renderWithReact(React.createElement(RescueMode));

    for (const label of [
      "Payment problem",
      "Transport problem",
      "Language barrier",
      "Ticket or booking problem",
      "Lost item",
      "Health or immediate safety",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Official emergency guidance");
    expect(html).toContain("Select a situation first.");
    expect(html).not.toContain("Submit for manual review");
    expect(html).not.toContain("24/7 response");
    expect(html).not.toContain("Book now");
  });

  it("does not place an incident narrative field in the category selector", () => {
    const html = renderWithReact(React.createElement(RescueMode));

    expect(html).not.toContain("textarea");
    expect(html).not.toContain('name="description"');
    expect(html).toContain("We do not collect an incident description");
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
