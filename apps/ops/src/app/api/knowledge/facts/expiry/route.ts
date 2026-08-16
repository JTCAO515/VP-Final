import { NextResponse } from "next/server";
import { getKnowledgeService } from "../../store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../../../lib/opsAccess";

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  const expiredFacts = await getKnowledgeService().listExpiredFacts();
  return applyOpsCookies(
    NextResponse.json({ expiredFactIds: expiredFacts.map((fact) => fact.id) }),
    authorization.cookieResponse,
  );
}
