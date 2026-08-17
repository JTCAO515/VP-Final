import { NextResponse } from "next/server";
import { PoiFactSourceClassSchema } from "@visepanda/domain";
import { getKnowledgeService } from "../store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../lib/opsAccess";

export async function POST(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const body = (await request.json()) as {
    poiId?: unknown;
    factType?: unknown;
    value?: unknown;
    confidence?: unknown;
    sourceClass?: unknown;
    sourceLocator?: unknown;
    evidenceSummary?: unknown;
    expiresAt?: unknown;
  };
  const sourceClass = PoiFactSourceClassSchema.safeParse(body.sourceClass);
  if (
    typeof body.poiId !== "string" ||
    typeof body.factType !== "string" ||
    !isRecord(body.value) ||
    typeof body.confidence !== "number" ||
    !sourceClass.success ||
    typeof body.sourceLocator !== "string" ||
    typeof body.evidenceSummary !== "string"
  ) {
    return NextResponse.json(
      {
        error: "需要 poiId、事实类型、内容、置信度、来源等级、来源定位信息和证据摘要。",
      },
      { status: 400 },
    );
  }

  try {
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: "knowledge.fact.create.attempt",
      targetType: "poi",
      targetId: body.poiId,
      metadata: { factType: body.factType },
    });
    const fact = await getKnowledgeService().createFact({
      poiId: body.poiId,
      factType: body.factType,
      value: body.value,
      confidence: body.confidence,
      sourceClass: sourceClass.data,
      sourceLocator: body.sourceLocator,
      evidenceSummary: body.evidenceSummary,
      ...(typeof body.expiresAt === "string" || body.expiresAt === null
        ? { expiresAt: body.expiresAt }
        : {}),
    });
    return applyOpsCookies(NextResponse.json(fact), authorization.cookieResponse);
  } catch {
    return NextResponse.json({ error: "事实草稿未保存，请检查内容后重试。" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const body = (await request.json()) as {
    factId?: unknown;
    value?: unknown;
    confidence?: unknown;
    sourceClass?: unknown;
    sourceLocator?: unknown;
    evidenceSummary?: unknown;
    expiresAt?: unknown;
    expectedVersion?: unknown;
    action?: unknown;
  };
  const sourceClass = PoiFactSourceClassSchema.safeParse(body.sourceClass);
  if (
    typeof body.factId !== "string" ||
    (body.action !== "renew" &&
      body.action !== "deprecate" &&
      body.action !== "reject" &&
      body.action !== "approve_draft" &&
      !isRecord(body.value))
  ) {
    return NextResponse.json({ error: "需要事实 ID 和对象类型的内容。" }, { status: 400 });
  }

  try {
    const service = getKnowledgeService();
    await auditFactMutation(
      authorization,
      `knowledge.fact.${String(body.action ?? "update")}.attempt`,
      body.factId,
    );
    if (body.action === "renew") {
      const result = await service.renewFact({
        factId: body.factId,
        reviewedBy: authorization.access.userId,
        ...(typeof body.expiresAt === "string" || body.expiresAt === null
          ? { expiresAt: body.expiresAt }
          : {}),
      });
      return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
    }
    if (body.action === "approve_draft") {
      const expectedVersion = body.expectedVersion;
      if (
        typeof expectedVersion !== "number" ||
        !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 1
      ) {
        return applyOpsCookies(
          NextResponse.json({ error: "确认时需要草稿版本号。" }, { status: 400 }),
          authorization.cookieResponse,
        );
      }
      const result = await service.approveDraftFact({
        factId: body.factId,
        reviewedBy: authorization.access.userId,
        expectedVersion,
      });
      if (!result) {
        return applyOpsCookies(
          NextResponse.json({ error: "未找到事实草稿。" }, { status: 404 }),
          authorization.cookieResponse,
        );
      }
      return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
    }
    if (body.action === "deprecate") {
      const result = await service.deprecateFact({ factId: body.factId });
      return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
    }
    if (body.action === "reject") {
      const result = await service.rejectFact({
        factId: body.factId,
        rejectedBy: authorization.access.userId,
      });
      if (!result) {
        return applyOpsCookies(
          NextResponse.json({ error: "未找到事实草稿。" }, { status: 404 }),
          authorization.cookieResponse,
        );
      }
      return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
    }
    if (!isRecord(body.value)) {
      return NextResponse.json({ error: "需要对象类型的内容。" }, { status: 400 });
    }
    const result = await service.updateFact({
      factId: body.factId,
      value: body.value,
      ...(typeof body.confidence === "number" ? { confidence: body.confidence } : {}),
      ...(sourceClass.success ? { sourceClass: sourceClass.data } : {}),
      ...(typeof body.sourceLocator === "string" ? { sourceLocator: body.sourceLocator } : {}),
      ...(typeof body.evidenceSummary === "string"
        ? { evidenceSummary: body.evidenceSummary }
        : {}),
      ...(typeof body.expiresAt === "string" || body.expiresAt === null
        ? { expiresAt: body.expiresAt }
        : {}),
    });
    return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
  } catch {
    return NextResponse.json({ error: "事实未更新，请检查内容后重试。" }, { status: 400 });
  }
}

async function auditFactMutation(
  authorization: Extract<Awaited<ReturnType<typeof authorizeOpsRequest>>, { access: unknown }>,
  action: string,
  factId: string,
) {
  await authorization.authorizationService.recordAudit(authorization.access, {
    action,
    targetType: "poi_fact",
    targetId: factId,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
