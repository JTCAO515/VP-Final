import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { authorize, getDraft } = vi.hoisted(() => ({ authorize: vi.fn(), getDraft: vi.fn() }));

vi.mock("../../knowledge/store", () => ({
  getContentAiWalkingSkeletonService: () => ({ getDraft }),
}));

vi.mock("../../../../lib/opsAccess", async () => {
  const { NextResponse } = await import("next/server");
  return {
    applyOpsCookies: (response: Response) => response,
    authorizeOpsRequest: authorize,
    isAuthorizedOpsRequest: (value: unknown) => !(value instanceof NextResponse),
  };
});

import { GET } from "./route";

describe("Content AI walking skeleton route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockResolvedValue({
      access: {
        userId: "61000000-0000-4000-8000-000000000011",
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      },
      cookieResponse: new Response(),
    });
  });

  it("authorizes before asking the draft service for any record", async () => {
    const unauthorized = NextResponse.json({ error: "请先登录运营后台。" }, { status: 401 });
    authorize.mockResolvedValueOnce(unauthorized);

    const response = await GET(
      new Request("http://ops.local/api/content-ai/walking-skeleton?draftId=draft-1"),
    );

    expect(response.status).toBe(401);
    expect(getDraft).not.toHaveBeenCalled();
  });

  it("derives requester identity and reviewer visibility from the authorized session", async () => {
    getDraft.mockResolvedValue(null);

    const response = await GET(
      new Request("http://ops.local/api/content-ai/walking-skeleton?draftId=draft-1"),
    );

    expect(response.status).toBe(404);
    expect(getDraft).toHaveBeenCalledWith({
      draftId: "draft-1",
      requesterId: "61000000-0000-4000-8000-000000000011",
      canReview: true,
    });
  });
});
