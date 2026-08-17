import { NextResponse } from "next/server";
import {
  ContentAiWalkingSkeletonConflictError,
  ContentAiWalkingSkeletonNotFoundError,
} from "@visepanda/app-server";
import { PoiFactSourceClassSchema } from "@visepanda/domain";
import { getContentAiWalkingSkeletonService } from "../../knowledge/store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../lib/opsAccess";

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const draftId = new URL(request.url).searchParams.get("draftId");
  if (!draftId)
    return applyOpsCookies(
      NextResponse.json({ error: "需要草稿 ID。" }, { status: 400 }),
      authorization.cookieResponse,
    );

  try {
    const draft = await getContentAiWalkingSkeletonService().getDraft({
      draftId,
      requesterId: authorization.access.userId,
      canReview: authorization.access.permissions.includes("knowledge.write"),
    });
    return applyOpsCookies(
      draft
        ? NextResponse.json(draft)
        : NextResponse.json({ error: "未找到草稿。" }, { status: 404 }),
      authorization.cookieResponse,
    );
  } catch {
    return applyOpsCookies(
      NextResponse.json({ error: "内容草稿暂时不可用，请稍后重试。" }, { status: 503 }),
      authorization.cookieResponse,
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  if (process.env.VISEPANDA_RUNTIME_MODE !== "test") {
    return applyOpsCookies(
      NextResponse.json({ error: "此验证切片仅在测试环境可创建。" }, { status: 404 }),
      authorization.cookieResponse,
    );
  }
  const body = (await request.json()) as Record<string, unknown>;
  const sourceClass = PoiFactSourceClassSchema.safeParse(body.sourceClass);
  if (
    typeof body.poiId !== "string" ||
    typeof body.afterText !== "string" ||
    !sourceClass.success ||
    typeof body.sourceLocator !== "string" ||
    typeof body.evidenceSummary !== "string"
  ) {
    return applyOpsCookies(
      NextResponse.json({ error: "草稿字段不完整。" }, { status: 400 }),
      authorization.cookieResponse,
    );
  }
  try {
    const draft = await getContentAiWalkingSkeletonService().createFixtureDraft({
      ownerId: authorization.access.userId,
      poiId: body.poiId,
      afterText: body.afterText,
      sourceClass: sourceClass.data,
      sourceLocator: body.sourceLocator,
      evidenceSummary: body.evidenceSummary,
    });
    return applyOpsCookies(NextResponse.json(draft, { status: 201 }), authorization.cookieResponse);
  } catch {
    return applyOpsCookies(
      NextResponse.json({ error: "验证草稿未保存。" }, { status: 400 }),
      authorization.cookieResponse,
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  if (process.env.VISEPANDA_RUNTIME_MODE !== "test") {
    return applyOpsCookies(
      NextResponse.json({ error: "此验证切片仅在测试环境可发布。" }, { status: 404 }),
      authorization.cookieResponse,
    );
  }
  const body = (await request.json()) as { draftId?: unknown };
  if (typeof body.draftId !== "string") {
    return applyOpsCookies(
      NextResponse.json({ error: "需要草稿 ID。" }, { status: 400 }),
      authorization.cookieResponse,
    );
  }
  try {
    const draft = await getContentAiWalkingSkeletonService().publishDraft({
      draftId: body.draftId,
      reviewerId: authorization.access.userId,
    });
    return applyOpsCookies(NextResponse.json(draft), authorization.cookieResponse);
  } catch (error) {
    const status =
      error instanceof ContentAiWalkingSkeletonNotFoundError
        ? 404
        : error instanceof ContentAiWalkingSkeletonConflictError
          ? 409
          : 400;
    const message =
      error instanceof ContentAiWalkingSkeletonConflictError
        ? "草稿已过期，需要重新核对后再提交。"
        : error instanceof ContentAiWalkingSkeletonNotFoundError
          ? "未找到草稿。"
          : "草稿未发布。";
    return applyOpsCookies(
      NextResponse.json({ error: message }, { status }),
      authorization.cookieResponse,
    );
  }
}
