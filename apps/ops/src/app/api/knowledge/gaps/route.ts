import { NextResponse } from "next/server";
import { getKnowledgeService } from "../store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../lib/opsAccess";

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const status = new URL(request.url).searchParams.get("status");
  return applyOpsCookies(
    NextResponse.json(
      await getKnowledgeService().listGaps(
        status === "open" || status === "resolved" || status === "ignored" ? { status } : {},
      ),
    ),
    authorization.cookieResponse,
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const body = (await request.json()) as { question?: unknown; city?: unknown };
  if (typeof body.question !== "string") {
    return NextResponse.json({ error: "Expected question." }, { status: 400 });
  }

  await authorization.authorizationService.recordAudit(authorization.access, {
    action: "knowledge.gap.create.attempt",
    targetType: "knowledge_gap",
  });
  const gap = await getKnowledgeService().recordGap({
    question: body.question,
    ...(typeof body.city === "string" && body.city ? { city: body.city } : {}),
  });
  return applyOpsCookies(NextResponse.json(gap), authorization.cookieResponse);
}

export async function PATCH(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const body = (await request.json()) as {
    gapId?: unknown;
    status?: unknown;
    resolutionTarget?: unknown;
  };
  if (
    typeof body.gapId !== "string" ||
    (body.status !== "open" && body.status !== "resolved" && body.status !== "ignored")
  ) {
    return NextResponse.json({ error: "Expected gapId and status." }, { status: 400 });
  }

  await authorization.authorizationService.recordAudit(authorization.access, {
    action: "knowledge.gap.update.attempt",
    targetType: "knowledge_gap",
    targetId: body.gapId,
    metadata: { status: body.status },
  });
  const result = await getKnowledgeService().updateGap({
    gapId: body.gapId,
    status: body.status,
    ...(isResolutionTarget(body.resolutionTarget)
      ? { resolutionTarget: body.resolutionTarget }
      : {}),
  });

  if (!result) return NextResponse.json({ error: "Gap not found." }, { status: 404 });
  return applyOpsCookies(NextResponse.json(result), authorization.cookieResponse);
}

function isResolutionTarget(value: unknown): value is { kind: "poi_fact" | "guide"; id: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; id?: unknown };
  return (
    (candidate.kind === "poi_fact" || candidate.kind === "guide") &&
    typeof candidate.id === "string"
  );
}
