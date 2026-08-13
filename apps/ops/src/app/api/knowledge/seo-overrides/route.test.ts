import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInMemoryKnowledgeService,
  createInMemorySeoEditorialOverrideService,
} from "@visepanda/app-server";
import { INITIAL_POIS, type Poi } from "@visepanda/domain";

const { audit, authorize, getKnowledgeService, getSeoEditorialOverrideService } = vi.hoisted(
  () => ({
    audit: vi.fn(),
    authorize: vi.fn(),
    getKnowledgeService: vi.fn(),
    getSeoEditorialOverrideService: vi.fn(),
  }),
);

vi.mock("../store", () => ({ getKnowledgeService }));
vi.mock("./store", () => ({ getSeoEditorialOverrideService }));
vi.mock("../../../../lib/opsAccess", async () => {
  const { NextResponse } = await import("next/server");
  return {
    applyOpsCookies: (response: Response) => response,
    authorizeOpsRequest: authorize,
    isAuthorizedOpsRequest: (value: unknown) => !(value instanceof NextResponse),
  };
});

import { DELETE, GET, POST } from "./route";

const editorId = "30000000-0000-4000-8000-000000000021";
const eligiblePoiId = "8bdf3a4e-541b-4e01-a1f8-fec4546b7061";

describe("Ops SEO editorial override route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockResolvedValue({
      access: {
        userId: editorId,
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      },
      authorizationService: { recordAudit: audit },
      cookieResponse: new Response(),
    });
    getKnowledgeService.mockReturnValue(createInMemoryKnowledgeService([eligiblePoi()], []));
    getSeoEditorialOverrideService.mockReturnValue(createInMemorySeoEditorialOverrideService());
  });

  it("writes an eligible presentation override and restores generated copy on delete", async () => {
    const save = await POST(
      new Request("http://ops.local/api/knowledge/seo-overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          poiId: eligiblePoiId,
          intent: "transport",
          title: "Getting to Yu Garden",
          summary: "",
          emphasis: "",
        }),
      }),
    );

    expect(save.status).toBe(200);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "knowledge.seo_override.save.attempt",
        targetId: eligiblePoiId,
      }),
    );
    const get = await GET(
      new Request(
        `http://ops.local/api/knowledge/seo-overrides?poiId=${eligiblePoiId}&intent=transport`,
      ),
    );
    expect((await get.json()) as { override: { title: string } }).toMatchObject({
      override: { title: "Getting to Yu Garden" },
    });

    const remove = await DELETE(
      new Request(
        `http://ops.local/api/knowledge/seo-overrides?poiId=${eligiblePoiId}&intent=transport`,
        { method: "DELETE" },
      ),
    );
    expect(await remove.json()).toEqual({ removed: true });
  });

  it("rejects a write when the POI and intent have no current evidence-backed candidate", async () => {
    const response = await POST(
      new Request("http://ops.local/api/knowledge/seo-overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          poiId: eligiblePoiId,
          intent: "rainy_day",
          title: "Unsupported page",
          summary: "",
          emphasis: "",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(audit).not.toHaveBeenCalled();
  });
});

function eligiblePoi(): Poi {
  const seed = INITIAL_POIS.find((poi) => poi.id === "poi-shanghai-yu-garden");
  if (!seed) throw new Error("Yu Garden fixture is required");
  return {
    ...seed,
    id: eligiblePoiId,
    facts: seed.facts.map((fact) => ({ ...fact, poiId: eligiblePoiId })),
  };
}
