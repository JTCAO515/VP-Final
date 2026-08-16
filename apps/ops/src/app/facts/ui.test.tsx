import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FactEditor } from "./ui";

describe("FactEditor local-display authoring", () => {
  it("renders the dedicated draft-only Show-to-Local form and address safety warning boundary", () => {
    const html = renderToStaticMarkup(<FactEditor />);

    expect(html).toContain("Show-to-Local facts");
    expect(html).toContain("Each local-display fact starts as a draft");
    expect(html).toContain("Save local-display draft");
    expect(html).toContain("Text (maximum 500 characters)");
    expect(html).toContain("Source URL or evidence reference");
    expect(html).toContain("Evidence summary (no personal contact details)");
    expect(html).not.toContain("verifiedAt");
    expect(html).not.toContain("Approve all");
  });
});
