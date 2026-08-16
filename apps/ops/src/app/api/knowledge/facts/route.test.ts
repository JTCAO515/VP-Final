import { beforeEach, describe, expect, it, vi } from "vitest";

const { approveDraftFact, audit, authorize, rejectFact, renewFact } = vi.hoisted(() => ({
  approveDraftFact: vi.fn(),
  audit: vi.fn(),
  authorize: vi.fn(),
  rejectFact: vi.fn(),
  renewFact: vi.fn(),
}));

vi.mock("../store", () => ({
  getKnowledgeService: () => ({ approveDraftFact, rejectFact, renewFact }),
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
    approveDraftFact.mockResolvedValue({ id: "fact-1", status: "reviewed" });
    rejectFact.mockResolvedValue({ id: "fact-1", status: "rejected" });
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

  it("rejects one draft through the authenticated operator identity", async () => {
    const response = await PATCH(
      new Request("http://ops.local/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          factId: "fact-1",
          action: "reject",
          rejectedBy: "attacker-authored-id",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rejectFact).toHaveBeenCalledWith({
      factId: "fact-1",
      rejectedBy: "30000000-0000-4000-8000-000000000021",
    });
  });

  it("approves exactly one displayed draft with a server-derived reviewer and version", async () => {
    const response = await PATCH(
      new Request("http://ops.local/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          factId: "fact-1",
          action: "approve_draft",
          expectedVersion: 3,
          reviewedBy: "attacker-authored-id",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(approveDraftFact).toHaveBeenCalledWith({
      factId: "fact-1",
      reviewedBy: "30000000-0000-4000-8000-000000000021",
      expectedVersion: 3,
    });
    expect(renewFact).not.toHaveBeenCalled();
  });

  it("refuses an approval without one displayed draft version or a bulk id list", async () => {
    const response = await PATCH(
      new Request("http://ops.local/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          factIds: ["fact-1", "fact-2"],
          action: "approve_draft",
          expectedVersion: 3,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(approveDraftFact).not.toHaveBeenCalled();
  });

  it("does not report a missing draft as rejected", async () => {
    rejectFact.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://ops.local/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factId: "missing", action: "reject" }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Draft fact was not found." });
  });
});
