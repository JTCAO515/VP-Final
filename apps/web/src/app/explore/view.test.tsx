import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Poi } from "@visepanda/domain";
import { ExploreView } from "./view";

const basePoi: Poi = {
  id: "poi-1",
  city: "Shanghai",
  category: "attraction",
  nameEn: "Example place",
  sourceIds: {},
  facts: [],
  commercialLinks: [],
};

describe("ExploreView commercial links", () => {
  it("does not render a commercial action when the POI has no active link", () => {
    const html = renderWithReact(
      React.createElement(ExploreView, {
        pois: [basePoi],
        availability: "ready",
        asOf: "2026-08-14T00:00:00.000Z",
      }),
    );

    expect(html).not.toContain("Continue to partner");
    expect(html).not.toContain("We may earn a commission");
  });

  it("renders an active POI link through the outbound gateway with its disclosure", () => {
    const html = renderWithReact(
      React.createElement(ExploreView, {
        pois: [
          {
            ...basePoi,
            commercialLinks: [
              {
                id: "link-1",
                poiId: "poi-1",
                partner: "klook",
                url: "https://www.klook.com/en-US/activity/example",
                disclosure: "We may earn a commission when you continue to Klook.",
              },
            ],
          },
        ],
        availability: "ready",
        asOf: "2026-08-14T00:00:00.000Z",
      }),
    );

    expect(html).toContain("Continue to partner");
    expect(html).toContain("We may earn a commission when you continue to Klook.");
    expect(html).toContain(
      'href="/outbound?partner=klook&amp;url=https%3A%2F%2Fwww.klook.com%2Fen-US%2Factivity%2Fexample&amp;source=explore&amp;intent=commerce_intent&amp;entityId=poi-1"',
    );
    expect(html).not.toContain('href="https://www.klook.com');
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
