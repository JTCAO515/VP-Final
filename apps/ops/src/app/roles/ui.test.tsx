import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleManager } from "./ui";

const currentUserId = "40000000-0000-4000-8000-000000000001";

describe("RoleManager", () => {
  it("uses a complete email assignment flow and explains fixed least-privilege roles", () => {
    const html = renderToStaticMarkup(<RoleManager canWrite currentUserId={currentUserId} />);

    expect(html).toContain("Registered email address");
    expect(html).toContain("Add collaborator");
    expect(html).toContain("We never search or browse user accounts from Ops.");
    expect(html).toContain("Knowledge editor");
    expect(html).toContain("Human Help operator");
    expect(html).toContain("Ops administrator");
    expect(html).toContain("High-risk access");
    expect(html).toContain("Can view all cost summaries");
    expect(html).not.toContain("Supabase user UUID");
  });

  it("does not render a membership mutation form for a read-only viewer", () => {
    const html = renderToStaticMarkup(
      <RoleManager canWrite={false} currentUserId={currentUserId} />,
    );

    expect(html).toContain("only an Ops administrator can change them");
    expect(html).not.toContain("Add collaborator</button>");
  });

  it("renders the current collaborator as self-managed only by the server and disables local controls", () => {
    const html = renderToStaticMarkup(
      <RoleManager
        canWrite
        currentUserId={currentUserId}
        initialMemberships={[
          {
            userId: currentUserId,
            role: "admin",
            createdBy: null,
            createdAt: "2026-08-16T00:00:00.000Z",
            updatedAt: "2026-08-16T00:00:00.000Z",
            revokedAt: null,
            revokedBy: null,
          },
        ]}
      />,
    );

    expect(html).toContain("You cannot change your own access.");
    expect(html).not.toContain("Remove access");
    expect(html).toContain('disabled=""');
  });
});
