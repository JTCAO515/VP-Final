import { KnowledgeImportValidationError } from "@visepanda/app-server";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getKnowledgeBulkImportService } from "../store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../lib/opsAccess";

const ImportRequestSchema = z
  .object({
    csv: z.string().min(1).max(1_000_000),
    mode: z.enum(["dry-run", "commit"]).default("dry-run"),
  })
  .strict();

export async function POST(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  const parsed = await parseRequest(request);
  if (!parsed.success) {
    return applyOpsCookies(
      NextResponse.json({ error: parsed.error }, { status: 400 }),
      authorization.cookieResponse,
    );
  }

  try {
    const service = getKnowledgeBulkImportService();
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: `knowledge.bulk_import.${parsed.data.mode}.attempt`,
      targetType: "knowledge_import",
      targetId: "csv",
    });
    const report =
      parsed.data.mode === "dry-run"
        ? await service.dryRun(parsed.data.csv)
        : await service.commit(parsed.data.csv);
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: `knowledge.bulk_import.${parsed.data.mode}.completed`,
      targetType: "knowledge_import",
      targetId: "csv",
      metadata: {
        totalRows: report.totalRows,
        readyRows: report.readyRows,
        errorCount: report.errors.length,
        createdPois: report.createdPois,
        createdFacts: report.createdFacts,
        duplicateFacts: report.duplicateFacts,
      },
    });
    return applyOpsCookies(
      NextResponse.json(
        { mode: parsed.data.mode, report },
        { status: parsed.data.mode === "commit" ? 201 : 200 },
      ),
      authorization.cookieResponse,
    );
  } catch (error) {
    if (error instanceof KnowledgeImportValidationError) {
      return applyOpsCookies(
        NextResponse.json({ error: error.message, report: error.report }, { status: 422 }),
        authorization.cookieResponse,
      );
    }
    return applyOpsCookies(
      NextResponse.json({ error: "Knowledge import is unavailable." }, { status: 503 }),
      authorization.cookieResponse,
    );
  }
}

async function parseRequest(
  request: Request,
): Promise<
  { success: true; data: z.infer<typeof ImportRequestSchema> } | { success: false; error: string }
> {
  try {
    const body: unknown = await request.json();
    const parsed = ImportRequestSchema.safeParse(body);
    return parsed.success
      ? { success: true, data: parsed.data }
      : { success: false, error: parsed.error.issues.map((issue) => issue.message).join("; ") };
  } catch {
    return { success: false, error: "Expected a JSON import request." };
  }
}
