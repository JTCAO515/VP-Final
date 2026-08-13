import {
  resolveVisePodStudioEnvironment,
  type VisePodProvisioningService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../../lib/opsAccess";
import { getVisePodProvisioningService } from "./store";

type Dependencies = {
  authorize: (
    request: Request,
    permission: "visepod.provision",
  ) => Promise<AuthorizedOpsRequest | NextResponse>;
  getService: () => VisePodProvisioningService;
  environment: () => string | undefined;
};

const defaults: Dependencies = {
  authorize: authorizeOpsRequest,
  getService: getVisePodProvisioningService,
  environment: () => process.env.VISEPOD_STUDIO_ENVIRONMENT,
};

export async function handleVisePodProvisioningToken(
  request: Request,
  dependencies: Dependencies = defaults,
) {
  const authorization = await dependencies.authorize(request, "visepod.provision");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const issued = await dependencies
      .getService()
      .issue(authorization.access, resolveVisePodStudioEnvironment(dependencies.environment()));
    return applyOpsCookies(
      NextResponse.json({ ok: true, ...issued }, { status: 201 }),
      authorization.cookieResponse,
    );
  } catch {
    return applyOpsCookies(
      NextResponse.json(
        { ok: false, error: "VisePod Studio provisioning is unavailable." },
        { status: 503 },
      ),
      authorization.cookieResponse,
    );
  }
}
