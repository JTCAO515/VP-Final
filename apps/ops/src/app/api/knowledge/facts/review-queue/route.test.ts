import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getKnowledgeService } from "../../store";
import { authorizeOpsRequest } from "../../../../../lib/opsAccess";
import { GET } from "./route";

vi.mock("../../store", () => ({ getKnowledgeService: vi.fn() }));
vi.mock("../../../../../lib/opsAccess", () => ({
  applyOpsCookies: (response: Response) => response,
  authorizeOpsRequest: vi.fn(),
  isAuthorizedOpsRequest: (value: unknown) => !(value instanceof NextResponse),
}));

describe("GET /api/knowledge/facts/review-queue", () => {
  const listDraftFactReviewQueue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeOpsRequest).mockResolvedValue({
      access: {
        userId: "30000000-0000-4000-8000-000000000021",
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      },
      authorizationService: {} as never,
      cookieResponse: NextResponse.next(),
    });
    vi.mocked(getKnowledgeService).mockReturnValue({ listDraftFactReviewQueue } as never);
  });

  it("authorizes knowledge.write before reading a private batch filter", async () => {
    listDraftFactReviewQueue.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "https://ops.example.test/api/knowledge/facts/review-queue?importBatchId=30000000-0000-4000-8000-000000000001",
      ),
    );

    expect(response.status).toBe(200);
    expect(authorizeOpsRequest).toHaveBeenCalledWith(expect.any(Request), "knowledge.write");
    expect(listDraftFactReviewQueue).toHaveBeenCalledWith({
      importBatchId: "30000000-0000-4000-8000-000000000001",
    });
  });

  it("rejects unknown or malformed filters without querying the service", async () => {
    const response = await GET(
      new Request("https://ops.example.test/api/knowledge/facts/review-queue?all=true"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unexpected filter: all." });
    expect(listDraftFactReviewQueue).not.toHaveBeenCalled();
  });

  it("does not query the queue when Ops authorization is denied", async () => {
    vi.mocked(authorizeOpsRequest).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }) as never,
    );

    const response = await GET(
      new Request("https://ops.example.test/api/knowledge/facts/review-queue"),
    );

    expect(response.status).toBe(403);
    expect(listDraftFactReviewQueue).not.toHaveBeenCalled();
  });
});
