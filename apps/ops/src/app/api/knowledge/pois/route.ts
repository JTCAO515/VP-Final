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
