import {
  VisePodBindingDeviceNotFoundError,
  VisePodBindingIdempotencyConflictError,
  VisePodBindingProvisioningAccessDeniedError,
  VisePodBindingStateConflictError,
  VisePodBindingUserNotFoundError,
  asVisePodBindingReadResponse,
  type VisePodBindingService,
} from "@visepanda/app-server";
import {
  VisePodDeviceIdSchema,
  VisePodStudioBindRequestSchema,
  VisePodStudioErrorResponseSchema,
  VisePodStudioProvisioningTokenSchema,
  VisePodStudioRevokeRequestSchema,
  type VisePodStudioEnvironment,
} from "@visepanda/domain";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getVisePodBindingRuntime, type VisePodBindingRuntime } from "./store";

type RouteContext = { params: Promise<{ deviceId: string }> };
type Dependencies = {
  getRuntime: () => VisePodBindingRuntime;
};

const defaults: Dependencies = { getRuntime: getVisePodBindingRuntime };

export async function handleVisePodBindingGet(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaults,
) {
  return handle(
    request,
    context,
    dependencies,
    async ({ service, environment, token, deviceId }) => {
      return NextResponse.json(
        asVisePodBindingReadResponse(await service.get({ token, environment, deviceId })),
      );
    },
  );
}

export async function handleVisePodBindingPut(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaults,
) {
  return handle(
    request,
    context,
    dependencies,
    async ({ service, environment, token, deviceId }) => {
      const body = VisePodStudioBindRequestSchema.parse(await request.json());
      const result = await service.mutate({
        token,
        environment,
        command: { operation: "bind", deviceId, ...body },
      });
      return NextResponse.json(result, { status: result.outcome === "created" ? 201 : 200 });
    },
  );
}

export async function handleVisePodBindingDelete(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaults,
) {
  return handle(
    request,
    context,
    dependencies,
    async ({ service, environment, token, deviceId }) => {
      const body = VisePodStudioRevokeRequestSchema.parse(await request.json());
      return NextResponse.json(
        await service.mutate({
          token,
          environment,
          command: { operation: "unbind", deviceId, ...body },
        }),
      );
    },
  );
}

async function handle(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies,
  action: (input: {
    service: VisePodBindingService;
    environment: VisePodStudioEnvironment;
    token: string;
    deviceId: string;
  }) => Promise<NextResponse>,
) {
  try {
    const token = bearerToken(request);
    const { deviceId } = await context.params;
    const runtime = dependencies.getRuntime();
    return await action({ ...runtime, token, deviceId: VisePodDeviceIdSchema.parse(deviceId) });
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
  const [status, code] =
    error instanceof VisePodBindingProvisioningAccessDeniedError
      ? [403, "PROVISIONING_ACCESS_DENIED"]
      : error instanceof VisePodBindingDeviceNotFoundError
        ? [404, "DEVICE_NOT_FOUND"]
        : error instanceof VisePodBindingUserNotFoundError
          ? [404, "USER_NOT_FOUND"]
          : error instanceof VisePodBindingIdempotencyConflictError
            ? [409, "IDEMPOTENCY_KEY_CONFLICT"]
            : error instanceof VisePodBindingStateConflictError
              ? [409, "BINDING_STATE_CONFLICT"]
              : error instanceof ZodError || error instanceof SyntaxError
                ? [400, "INVALID_REQUEST"]
                : [503, "PROVISIONING_ACCESS_DENIED"];
  return NextResponse.json(VisePodStudioErrorResponseSchema.parse({ error: { code } }), { status });
}
