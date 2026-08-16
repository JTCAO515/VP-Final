import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorize, createPoi, updatePoi, audit } = vi.hoisted(() => ({
  authorize: vi.fn(),
  createPoi: vi.fn(),
  updatePoi: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../store", () => ({
  getKnowledgeService: () => ({ createPoi, updatePoi }),
}));

vi.mock("../../../../lib/opsAccess", () => ({
  applyOpsCookies: (response: Response) => response,
  authorizeOpsRequest: authorize,
  isAuthorizedOpsRequest: (value: unknown) => !(value instanceof NextResponse),
}));

import { PATCH, POST } from "./route";

const fields = {
  city: "Shanghai",
  category: "attraction",
  nameEn: "Yu Garden",
  nameZh: "豫园",
  latitude: 31.227,
  longitude: 121.492,
};

describe("Ops knowledge POI write route", () => {
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
    createPoi.mockResolvedValue({ id: "30000000-0000-4000-8000-000000000001", ...fields });
    updatePoi.mockResolvedValue({ id: "30000000-0000-4000-8000-000000000001", ...fields });
  });

  it("authorizes before parsing or reading a write body", async () => {
    authorize.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const response = await POST(jsonRequest({ sourceIds: { attacker: "value" } }));

    expect(response.status).toBe(403);
    expect(createPoi).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("rejects non-canonical create fields", async () => {
    const response = await POST(jsonRequest({ ...fields, sourceIds: { attacker: "value" } }));

    expect(response.status).toBe(400);
    expect(createPoi).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("uses the knowledge.write route to create a canonical POI and audits field names only", async () => {
    const response = await POST(jsonRequest(fields));

    expect(response.status).toBe(201);
    expect(createPoi).toHaveBeenCalledWith(fields);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "30000000-0000-4000-8000-000000000021" }),
      expect.objectContaining({
        action: "knowledge.poi.create.attempt",
        metadata: { fields: ["city", "category", "nameEn", "nameZh", "latitude", "longitude"] },
      }),
    );
    expect(JSON.stringify(audit.mock.calls)).not.toContain("Yu Garden");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("豫园");
  });

  it("rejects a partial coordinate pair before any update write", async () => {
    const response = await PATCH(
      jsonRequest({
        id: "30000000-0000-4000-8000-000000000001",
        ...fields,
        longitude: null,
      }),
    );

    expect(response.status).toBe(400);
    expect(updatePoi).not.toHaveBeenCalled();
  });

  it("returns not found without fabricating an update", async () => {
    updatePoi.mockResolvedValue(null);
    const response = await PATCH(
      jsonRequest({ id: "30000000-0000-4000-8000-000000000001", ...fields }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "POI not found." });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("https://ops.example.test/api/knowledge/pois", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
