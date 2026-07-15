import { NextResponse } from "next/server";
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
  if (
    typeof body.poiId !== "string" ||
    typeof body.factType !== "string" ||
    !isRecord(body.value) ||
    typeof body.confidence !== "number" ||
    !isSourceClass(body.sourceClass) ||
    typeof body.sourceLocator !== "string" ||
    typeof body.evidenceSummary !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Expected poiId, factType, value, confidence, sourceClass, sourceLocator, and evidenceSummary.",
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
      sourceClass: body.sourceClass,
      sourceLocator: body.sourceLocator,
      evidenceSummary: body.evidenceSummary,
      ...(typeof body.expiresAt === "string" || body.expiresAt === null
        ? { expiresAt: body.expiresAt }
        : {}),
    });
    return applyOpsCookies(NextResponse.json(fact), authorization.cookieResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fact create failed." },
      { status: 400 },
    );
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
    action?: unknown;
  };
  if (
    typeof body.factId !== "string" ||
    (body.action !== "renew" && body.action !== "deprecate" && !isRecord(body.value))
  ) {
    return NextResponse.json({ error: "Expected factId and object value." }, { status: 400 });
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
        ...(typeof body.expiresAt === "string" || body.expiresAt === null
          ? { expiresAt: body.expiresAt }
          : {}),
      });
      return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
    }
    if (body.action === "deprecate") {
      const result = await service.deprecateFact({ factId: body.factId });
      return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
    }
    if (!isRecord(body.value)) {
      return NextResponse.json({ error: "Expected object value." }, { status: 400 });
    }
    const result = await service.updateFact({
      factId: body.factId,
      value: body.value,
      ...(typeof body.confidence === "number" ? { confidence: body.confidence } : {}),
      ...(isSourceClass(body.sourceClass) ? { sourceClass: body.sourceClass } : {}),
      ...(typeof body.sourceLocator === "string" ? { sourceLocator: body.sourceLocator } : {}),
      ...(typeof body.evidenceSummary === "string"
        ? { evidenceSummary: body.evidenceSummary }
        : {}),
      ...(typeof body.expiresAt === "string" || body.expiresAt === null
        ? { expiresAt: body.expiresAt }
        : {}),
    });
    return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fact update failed." },
      { status: 400 },
    );
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

function isSourceClass(
  value: unknown,
): value is
  | "official"
  | "operator_verified"
  | "reputable_editorial"
  | "user_report"
  | "model_output"
  | "uncorroborated_scrape" {
  return (
    value === "official" ||
    value === "operator_verified" ||
    value === "reputable_editorial" ||
    value === "user_report" ||
    value === "model_output" ||
    value === "uncorroborated_scrape"
  );
}
