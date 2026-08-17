import { NextResponse } from "next/server";
import { PoiCreateInputSchema, PoiUpdateInputSchema } from "@visepanda/domain";
import { getKnowledgeService } from "../store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../lib/opsAccess";

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const params = new URL(request.url).searchParams;
  const city = params.get("city");
  return applyOpsCookies(
    NextResponse.json(
      await getKnowledgeService().listPois({
        ...(city ? { city } : {}),
        includeExpired: params.get("includeExpired") === "1",
        includeDeprecated: params.get("includeDeprecated") === "1",
        includeDrafts: params.get("includeDrafts") === "1",
      }),
    ),
    authorization.cookieResponse,
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const parsed = PoiCreateInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "地点规范字段无效。" }, { status: 400 });
  }

  try {
    const poi = await getKnowledgeService().createPoi({
      ...parsed.data,
      actorId: authorization.access.userId,
    });
    return applyOpsCookies(NextResponse.json(poi, { status: 201 }), authorization.cookieResponse);
  } catch {
    return NextResponse.json({ error: "地点创建暂时不可用，请稍后重试。" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const parsed = PoiUpdateInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "地点规范字段无效。" }, { status: 400 });
  }

  try {
    const poi = await getKnowledgeService().updatePoi({
      ...parsed.data,
      actorId: authorization.access.userId,
    });
    if (!poi) return NextResponse.json({ error: "未找到地点。" }, { status: 404 });
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: "knowledge.poi.update.completed",
      targetType: "poi",
      targetId: poi.id,
      metadata: { fields: ["city", "category", "nameEn", "nameZh", "latitude", "longitude"] },
    });
    return applyOpsCookies(NextResponse.json(poi), authorization.cookieResponse);
  } catch {
    return NextResponse.json({ error: "地点更新暂时不可用，请稍后重试。" }, { status: 503 });
  }
}
