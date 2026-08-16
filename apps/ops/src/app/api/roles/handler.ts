import { OpsRoleSchema } from "@visepanda/app-server/ops-authorization";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../lib/opsAccess";

const MembershipInputSchema = z.object({ userId: z.string().uuid(), role: OpsRoleSchema });
const ExactEmailMembershipInputSchema = z.object({
  email: z.string().trim().email().max(320),
  role: OpsRoleSchema,
});
const MembershipRemovalInputSchema = z.object({ userId: z.string().uuid() });

type Dependencies = {
  authorize: (
    request: Request,
    permission: "membership.read" | "membership.write",
  ) => Promise<AuthorizedOpsRequest | NextResponse>;
};

const defaults: Dependencies = { authorize: authorizeOpsRequest };

export async function handleMembershipList(
  request: Request,
  dependencies: Dependencies = defaults,
) {
  const authorization = await dependencies.authorize(request, "membership.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const memberships = await authorization.authorizationService.listMemberships(
    authorization.access,
  );
  return applyOpsCookies(NextResponse.json(memberships), authorization.cookieResponse);
}

export async function handleMembershipSet(request: Request, dependencies: Dependencies = defaults) {
  const authorization = await dependencies.authorize(request, "membership.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const parsed = MembershipInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Expected a valid userId and role." },
      { status: 400 },
    );
  }
  try {
    const membership = await authorization.authorizationService.setMembership(
      authorization.access,
      parsed.data.userId,
      parsed.data.role,
    );
    return applyOpsCookies(NextResponse.json(membership), authorization.cookieResponse);
  } catch {
    return applyOpsCookies(
      NextResponse.json(
        { ok: false, error: "Membership change was not accepted." },
        { status: 409 },
      ),
      authorization.cookieResponse,
    );
  }
}

export async function handleMembershipAssignByExactEmail(
  request: Request,
  dependencies: Dependencies = defaults,
) {
  const authorization = await dependencies.authorize(request, "membership.write");
  if (!isAuthorizedOpsRequest(authorization)) {
    return authorization.status === 401 || authorization.status === 403
      ? membershipAssignmentUnavailable()
      : authorization;
  }
  const parsed = ExactEmailMembershipInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return applyOpsCookies(
      NextResponse.json(
        { ok: false, error: "Expected one complete email address and role." },
        { status: 400 },
      ),
      authorization.cookieResponse,
    );
  }
  try {
    const membership = await authorization.authorizationService.setMembershipByExactEmail(
      authorization.access,
      parsed.data.email,
      parsed.data.role,
    );
    if (!membership)
      return applyOpsCookies(membershipAssignmentUnavailable(), authorization.cookieResponse);
    return applyOpsCookies(NextResponse.json(membership), authorization.cookieResponse);
  } catch {
    return applyOpsCookies(membershipAssignmentUnavailable(), authorization.cookieResponse);
  }
}

export async function handleMembershipRevoke(
  request: Request,
  dependencies: Dependencies = defaults,
) {
  const authorization = await dependencies.authorize(request, "membership.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  const parsed = MembershipRemovalInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Expected a valid userId." }, { status: 400 });
  }
  try {
    const membership = await authorization.authorizationService.revokeMembership(
      authorization.access,
      parsed.data.userId,
    );
    if (!membership) {
      return applyOpsCookies(
        NextResponse.json({ ok: false, error: "Membership was not found." }, { status: 404 }),
        authorization.cookieResponse,
      );
    }
    return applyOpsCookies(NextResponse.json(membership), authorization.cookieResponse);
  } catch {
    return applyOpsCookies(
      NextResponse.json(
        { ok: false, error: "Membership removal was not accepted." },
        { status: 409 },
      ),
      authorization.cookieResponse,
    );
  }
}

function membershipAssignmentUnavailable() {
  return NextResponse.json(
    {
      ok: false,
      error: "Membership assignment is unavailable. Ask the person to register first if needed.",
    },
    { status: 404 },
  );
}
