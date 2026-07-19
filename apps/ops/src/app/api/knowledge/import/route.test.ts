import {
  KnowledgeImportValidationError,
  type KnowledgeBulkImportService,
  type KnowledgeImportReport,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getKnowledgeBulkImportService } from "../store";
import { authorizeOpsRequest } from "../../../../lib/opsAccess";
import { POST } from "./route";

vi.mock("../store", () => ({ getKnowledgeBulkImportService: vi.fn() }));
vi.mock("../../../../lib/opsAccess", () => ({
  applyOpsCookies: (target: NextResponse) => target,
  authorizeOpsRequest: vi.fn(),
  isAuthorizedOpsRequest: (value: unknown) => !(value instanceof NextResponse),
}));

const report: KnowledgeImportReport = {
  totalRows: 1,
  readyRows: 1,
  skippedRows: [],
  errors: [],
  createdPois: 1,
  mergedPois: 0,
  createdFacts: 1,
  duplicateFacts: 0,
};

describe("POST /api/knowledge/import", () => {
  const recordAudit = vi.fn();
  const dryRun = vi.fn<KnowledgeBulkImportService["dryRun"]>();
  const commit = vi.fn<KnowledgeBulkImportService["commit"]>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeOpsRequest).mockResolvedValue({
      access: {
        userId: "11111111-1111-4111-8111-111111111111",
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      },
      authorizationService: { recordAudit } as never,
      cookieResponse: NextResponse.next(),
    });
    vi.mocked(getKnowledgeBulkImportService).mockReturnValue({ dryRun, commit });
  });

  it("returns a sanitized dry-run report and records the trusted actor audit", async () => {
    dryRun.mockResolvedValue(report);

    const response = await POST(importRequest("dry-run"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "dry-run", report });
    expect(dryRun).toHaveBeenCalledWith("header\nrow");
    expect(recordAudit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: "11111111-1111-4111-8111-111111111111" }),
      expect.objectContaining({ action: "knowledge.bulk_import.dry-run.attempt" }),
    );
    expect(recordAudit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: "11111111-1111-4111-8111-111111111111" }),
      expect.objectContaining({ action: "knowledge.bulk_import.dry-run.completed" }),
    );
  });

  it("returns 422 with the row report when commit validation fails", async () => {
    const invalidReport = {
      ...report,
      readyRows: 0,
      errors: [{ row: 2, collectionRowId: "row-1", message: "city is invalid" }],
    };
    commit.mockRejectedValue(new KnowledgeImportValidationError(invalidReport));

    const response = await POST(importRequest("commit"));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Knowledge import contains invalid rows",
      report: invalidReport,
    });
  });

  it("does not expose database errors through the Ops response", async () => {
    commit.mockRejectedValue(new Error("postgresql://private-host/internal-table"));

    const response = await POST(importRequest("commit"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Knowledge import is unavailable." });
  });
});

function importRequest(mode: "dry-run" | "commit"): Request {
  return new Request("https://ops.example.test/api/knowledge/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv: "header\nrow", mode }),
  });
}
