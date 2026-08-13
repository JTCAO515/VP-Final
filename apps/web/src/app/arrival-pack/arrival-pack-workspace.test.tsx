import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createArrivalPack } from "@visepanda/domain";
import { ArrivalPackWorkspace, renderArrivalPackHtml } from "./arrival-pack-workspace";

describe("Arrival Pack workspace", () => {
  it("does not render a free-form export, payment, or booking claim before a Trip is loaded", () => {
    const html = renderWithReact(React.createElement(ArrivalPackWorkspace));

    expect(html).toContain("Arrival Pack");
    expect(html).toContain("Checking this browser for your current Trip...");
    expect(html).not.toContain("Book now");
    expect(html).not.toContain("Pay now");
    expect(html).not.toContain("textarea");
  });

  it("escapes Trip content when making a downloaded HTML file", () => {
    const pack = createArrivalPack({
      trip: {
        id: "trip-1",
        title: "<script>unsafe</script>",
        days: [
          {
            id: "day-1",
            dayNumber: 1,
            blocks: [{ id: "block-1", type: "transport", title: "<b>unsafe</b>" }],
          },
        ],
      },
      tripVersion: 0,
      generatedAt: new Date("2026-08-13T00:00:00.000Z"),
      expiresAt: new Date("2026-08-20T00:00:00.000Z"),
    });

    const html = renderArrivalPackHtml(pack);
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;unsafe&lt;/b&gt;");
    expect(html).not.toContain("<script>unsafe</script>");
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
