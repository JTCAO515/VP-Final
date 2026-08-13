import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RescueRuntimeConfiguration } from "./runtime";
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

  it("renders configured scope only as an optional, editable Human Help handoff", () => {
    const html = renderWithReact(
      React.createElement(RescueMode, { configuration: configuredPreview }),
    );

    expect(html).toContain("Current city for the limited Human Help preview");
    expect(html).toContain("09:00-21:00 China Standard Time");
    expect(html).not.toContain("24/7 response");
    expect(html).not.toContain("Pay now");
    expect(html).not.toContain("Request received");
  });
});

const configuredPreview: RescueRuntimeConfiguration = {
  availableTargetIds: ["payment_preparation"],
  actionHrefs: { payment_preparation: "/guides/payment" },
  humanHelpAvailability: {
    status: "available",
    supportedCities: ["Shanghai"],
    supportedCategories: ["transport_problem"],
    hoursLabel: "09:00-21:00 China Standard Time",
    responseExpectation: "best_effort_no_sla",
    operationalOwnerId: "ops-preview-shanghai",
  },
};

function renderWithReact(element: React.ReactElement) {
  const runtimeGlobal = globalThis as typeof globalThis & { React?: typeof React };
  runtimeGlobal.React = React;
  try {
    return renderToStaticMarkup(element);
  } finally {
    delete runtimeGlobal.React;
  }
}
