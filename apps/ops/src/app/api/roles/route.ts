import { OpsRoleSchema } from "@visepanda/app-server/ops-authorization";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
} from "../../../lib/opsAccess";

const MembershipInputSchema = z.object({ userId: z.string().uuid(), role: OpsRoleSchema });

export async function GET(request: Request) {
  const authorization = await authorizeOpsRequest(request, "membership.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const memberships = await authorization.authorizationService.listMemberships(
    authorization.access,
  );
  return applyOpsCookies(NextResponse.json(memberships), authorization.cookieResponse);
}

export async function PUT(request: Request) {
  const authorization = await authorizeOpsRequest(request, "membership.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const parsed = MembershipInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Expected a valid userId and role." },
      { status: 400 },
    );
  }
  const membership = await authorization.authorizationService.setMembership(
    authorization.access,
    parsed.data.userId,
    parsed.data.role,
  );
  return applyOpsCookies(NextResponse.json(membership), authorization.cookieResponse);
}
