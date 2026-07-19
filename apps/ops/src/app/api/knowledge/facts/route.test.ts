import { beforeEach, describe, expect, it, vi } from "vitest";

const { audit, authorize, renewFact } = vi.hoisted(() => ({
  audit: vi.fn(),
  authorize: vi.fn(),
  renewFact: vi.fn(),
}));

vi.mock("../store", () => ({
  getKnowledgeService: () => ({ renewFact }),
}));

vi.mock("../../../../lib/opsAccess", async () => {
  const { NextResponse } = await import("next/server");
  return {
    applyOpsCookies: (response: Response) => response,
    authorizeOpsRequest: authorize,
    isAuthorizedOpsRequest: (value: unknown) => !(value instanceof NextResponse),
  };
});

import { PATCH } from "./route";

describe("Ops knowledge fact review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockResolvedValue({
      access: {
        userId: "30000000-0000-4000-8000-000000000021",
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      },
      authorizationService: { recordAudit: audit },
      cookieResponse: new Response(),
    });
    renewFact.mockResolvedValue({ id: "fact-1", status: "reviewed" });
  });

  it("uses the authenticated reviewer and ignores a body identity", async () => {
    const response = await PATCH(
      new Request("http://ops.local/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          factId: "fact-1",
          action: "renew",
          reviewedBy: "attacker-authored-id",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(renewFact).toHaveBeenCalledWith({
      factId: "fact-1",
      reviewedBy: "30000000-0000-4000-8000-000000000021",
    });
  });
});
