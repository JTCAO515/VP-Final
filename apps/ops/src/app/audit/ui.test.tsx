import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditEventCard, AuditLedger } from "./ui";

describe("AuditLedger", () => {
  it("renders only read-only exact filters and bounded-window guidance", () => {
    const html = renderToStaticMarkup(<AuditLedger />);
    expect(html).toContain("Exact actor id");
    expect(html).toContain("Exact action");
    expect(html).toContain("at most 90 days");
    expect(html).not.toContain("Delete");
    expect(html).not.toContain("Export");
  });

  it("renders sanitized audit metadata without mutation controls", () => {
    const html = renderToStaticMarkup(
      <AuditEventCard
        event={{
          id: "x",
          actorId: "actor",
          action: "membership.revoked",
          targetType: "ops_membership",
          targetId: "target",
          metadata: { role: "editor" },
          createdAt: "2026-08-16T00:00:00.000Z",
        }}
      />,
    );
    expect(html).toContain("membership.revoked");
    expect(html).toContain("editor");
    expect(html).not.toContain("Edit");
  });
});
