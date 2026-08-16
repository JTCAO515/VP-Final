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
    return NextResponse.json({ error: "Invalid canonical POI fields." }, { status: 400 });
  }

  try {
    const poi = await getKnowledgeService().createPoi({
      ...parsed.data,
      actorId: authorization.access.userId,
    });
    return applyOpsCookies(NextResponse.json(poi, { status: 201 }), authorization.cookieResponse);
  } catch {
    return NextResponse.json({ error: "POI create failed." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const parsed = PoiUpdateInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid canonical POI fields." }, { status: 400 });
  }

  try {
    const poi = await getKnowledgeService().updatePoi({
      ...parsed.data,
      actorId: authorization.access.userId,
    });
    if (!poi) return NextResponse.json({ error: "POI not found." }, { status: 404 });
    await authorization.authorizationService.recordAudit(authorization.access, {
      action: "knowledge.poi.update.completed",
      targetType: "poi",
      targetId: poi.id,
      metadata: { fields: ["city", "category", "nameEn", "nameZh", "latitude", "longitude"] },
    });
    return applyOpsCookies(NextResponse.json(poi), authorization.cookieResponse);
  } catch {
    return NextResponse.json({ error: "POI update failed." }, { status: 503 });
  }
}
