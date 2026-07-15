import { NextResponse } from "next/server";
import { getHumanTaskService } from "./store";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../lib/opsAccess";

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "task.contact.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const tasks = await getHumanTaskService().listForOps();
    return applyOpsCookies(NextResponse.json(tasks), authorization.cookieResponse);
  } catch {
    return applyOpsCookies(
      NextResponse.json(
        { ok: false, error: "Human Task intake is temporarily unavailable." },
        { status: 503 },
      ),
      authorization.cookieResponse,
    );
  }
}
