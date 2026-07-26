import {
  PartnerActivationConfirmationError,
  PartnerAdministrationForbiddenError,
  PartnerConfigurationConflictError,
  PartnerConfigurationInputSchema,
  PartnerConfigurationNotFoundError,
  PartnerStatusChangeInputSchema,
  type PartnerAdministrationService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../lib/opsAccess";
import { getPartnerAdministrationService } from "./store";

type Dependencies = {
  authorize: (
    request: Request,
    permission: "partner.read" | "partner.write",
  ) => Promise<AuthorizedOpsRequest | NextResponse>;
  getService: () => PartnerAdministrationService;
};
type PartnerRouteContext = { params: Promise<{ partnerKey: string }> };

const defaultDependencies: Dependencies = {
  authorize: authorizeOpsRequest,
  getService: getPartnerAdministrationService,
};

export async function handlePartnersGet(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "partner.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const partners = await dependencies.getService().listPartners(authorization.access);
    return applyOpsCookies(NextResponse.json({ ok: true, partners }), authorization.cookieResponse);
  } catch (error) {
    return partnerErrorResponse(error, authorization.cookieResponse, "load");
  }
}

export async function handlePartnerGet(
  request: Request,
  context: PartnerRouteContext,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "partner.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const { partnerKey } = await context.params;
    const partner = await dependencies.getService().getPartner(authorization.access, partnerKey);
    return applyOpsCookies(NextResponse.json({ ok: true, partner }), authorization.cookieResponse);
  } catch (error) {
    return partnerErrorResponse(error, authorization.cookieResponse, "load");
  }
}

export async function handlePartnerCreate(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "partner.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const input = PartnerConfigurationInputSchema.parse(await request.json());
    const partner = await dependencies.getService().createPartner(authorization.access, input);
    return applyOpsCookies(
      NextResponse.json({ ok: true, partner }, { status: 201 }),
      authorization.cookieResponse,
    );
  } catch (error) {
    return partnerErrorResponse(error, authorization.cookieResponse, "create");
  }
}

export async function handlePartnerUpdate(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "partner.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const input = PartnerConfigurationInputSchema.parse(await request.json());
    const partner = await dependencies.getService().updatePartner(authorization.access, input);
    return applyOpsCookies(NextResponse.json({ ok: true, partner }), authorization.cookieResponse);
  } catch (error) {
    return partnerErrorResponse(error, authorization.cookieResponse, "update");
  }
}

export async function handlePartnerStatusChange(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "partner.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const input = PartnerStatusChangeInputSchema.parse(await request.json());
    const partner = await dependencies
      .getService()
      .changePartnerStatus(authorization.access, input);
    return applyOpsCookies(NextResponse.json({ ok: true, partner }), authorization.cookieResponse);
  } catch (error) {
    return partnerErrorResponse(error, authorization.cookieResponse, "change status");
  }
}

function partnerErrorResponse(error: unknown, cookies: NextResponse, operation: string) {
  const status =
    error instanceof ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof PartnerAdministrationForbiddenError
        ? 403
        : error instanceof PartnerConfigurationNotFoundError
          ? 404
          : error instanceof PartnerConfigurationConflictError ||
              error instanceof PartnerActivationConfirmationError
            ? 409
            : 503;
  const message =
    status === 503
      ? `Partner configuration ${operation} is temporarily unavailable.`
      : error instanceof Error
        ? error.message
        : `Partner configuration ${operation} failed.`;
  return applyOpsCookies(NextResponse.json({ ok: false, error: message }, { status }), cookies);
}
