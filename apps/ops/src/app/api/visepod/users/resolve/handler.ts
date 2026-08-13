import {
  VisePodBindingProvisioningAccessDeniedError,
  VisePodStudioUserLookupRateLimitUnavailableError,
  VisePodUserLookupNotFoundError,
  VisePodUserLookupRateLimitedError,
  type VisePodUserResolutionService,
} from "@visepanda/app-server";
import {
  VisePodStudioErrorResponseSchema,
  VisePodStudioExactUserLookupRequestSchema,
  VisePodStudioExactUserLookupResponseSchema,
  VisePodStudioProvisioningTokenSchema,
} from "@visepanda/domain";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getVisePodUserResolutionRuntime, type VisePodUserResolutionRuntime } from "./store";

type Dependencies = { getRuntime: () => VisePodUserResolutionRuntime };
const defaults: Dependencies = { getRuntime: getVisePodUserResolutionRuntime };

export async function handleVisePodUserResolve(
  request: Request,
  dependencies: Dependencies = defaults,
) {
  try {
    const token = bearerToken(request);
    const body = VisePodStudioExactUserLookupRequestSchema.parse(await request.json());
    const runtime = dependencies.getRuntime();
    const user = await runtime.service.resolve({
      token,
      environment: runtime.environment,
      request: body,
    });
    return NextResponse.json(VisePodStudioExactUserLookupResponseSchema.parse({ user }));
  } catch (error) {
    return studioErrorResponse(error);
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match?.[1]) throw new ZodError([]);
  return VisePodStudioProvisioningTokenSchema.parse(match[1]);
}

function studioErrorResponse(error: unknown) {
  const mapped =
    error instanceof VisePodBindingProvisioningAccessDeniedError
      ? { status: 403, code: "PROVISIONING_ACCESS_DENIED" as const }
      : error instanceof VisePodUserLookupNotFoundError
        ? { status: 404, code: "USER_NOT_FOUND" as const }
        : error instanceof VisePodUserLookupRateLimitedError
          ? {
              status: 429,
              code: "USER_LOOKUP_RATE_LIMITED" as const,
              retryAfter: error.retryAfterSeconds,
            }
          : error instanceof VisePodStudioUserLookupRateLimitUnavailableError
            ? { status: 503, code: "USER_LOOKUP_UNAVAILABLE" as const }
            : error instanceof ZodError || error instanceof SyntaxError
              ? { status: 400, code: "INVALID_REQUEST" as const }
              : { status: 503, code: "USER_LOOKUP_UNAVAILABLE" as const };
  const response = NextResponse.json(
    VisePodStudioErrorResponseSchema.parse({ error: { code: mapped.code } }),
    { status: mapped.status },
  );
  if ("retryAfter" in mapped) response.headers.set("retry-after", String(mapped.retryAfter));
  return response;
}

export type { VisePodUserResolutionService };
