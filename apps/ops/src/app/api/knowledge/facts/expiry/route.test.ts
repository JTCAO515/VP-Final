import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorize, listExpiredFacts } = vi.hoisted(() => ({
  authorize: vi.fn(),
  listExpiredFacts: vi.fn(),
}));

vi.mock("../../store", () => ({
  getKnowledgeService: () => ({ listExpiredFacts }),
}));

vi.mock("../../../../../lib/opsAccess", async () => {
  const { NextResponse } = await import("next/server");
  return {
    applyOpsCookies: (response: Response) => response,
    authorizeOpsRequest: authorize,
    isAuthorizedOpsRequest: (value: unknown) => !(value instanceof NextResponse),
  };
});

import { GET } from "./route";

describe("Ops knowledge fact expiry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockResolvedValue({
      access: { userId: "30000000-0000-4000-8000-000000000021", permissions: ["knowledge.write"] },
      cookieResponse: new Response(),
    });
    listExpiredFacts.mockResolvedValue([{ id: "fact-expired" }]);
  });

  it("requires knowledge.write before returning only expired fact identifiers", async () => {
    const response = await GET(new Request("http://ops.local/api/knowledge/facts/expiry"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ expiredFactIds: ["fact-expired"] });
    expect(listExpiredFacts).toHaveBeenCalledWith();
  });

  it("rejects before reading expiry data when knowledge.write is unavailable", async () => {
    const { NextResponse } = await import("next/server");
    authorize.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

    const response = await GET(new Request("http://ops.local/api/knowledge/facts/expiry"));

    expect(response.status).toBe(403);
    expect(listExpiredFacts).not.toHaveBeenCalled();
  });
});
