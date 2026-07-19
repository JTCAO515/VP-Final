import {
  HumanTaskNotFoundError,
  HumanTaskTransitionForbiddenError,
  HumanTaskTransitionPolicyError,
} from "@visepanda/app-server";
import {
  HumanTaskTransitionCommandSchema,
  InvalidHumanTaskTransitionError,
} from "@visepanda/domain";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../../../lib/opsAccess";
import { getHumanTaskService } from "../../store";

type RouteContext = { params: Promise<{ taskId: string }> };
type Dependencies = {
  authorize: (request: Request) => Promise<AuthorizedOpsRequest | NextResponse>;
  getService: typeof getHumanTaskService;
};

const defaultDependencies: Dependencies = {
  authorize: (request) => authorizeOpsRequest(request, "task.write"),
  getService: getHumanTaskService,
};

export async function handleTaskStatusPatch(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request);
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const { taskId } = await context.params;
    const command = HumanTaskTransitionCommandSchema.parse(await request.json());
    const result = await dependencies.getService().transition({
      taskId,
      actor: authorization.access,
      toStatus: command.to_status,
      reason: command.reason,
    });
    return applyOpsCookies(
      NextResponse.json({
        ok: true,
        task: {
          id: result.task.id,
          status: result.task.status,
          updated_at: result.task.updated_at,
          retention_expires_at: result.task.retention_expires_at,
        },
        transition: result.transition,
      }),
      authorization.cookieResponse,
    );
  } catch (error) {
    const status =
      error instanceof ZodError || error instanceof SyntaxError
        ? 400
        : error instanceof HumanTaskTransitionForbiddenError
          ? 403
          : error instanceof HumanTaskNotFoundError
            ? 404
            : error instanceof InvalidHumanTaskTransitionError ||
                error instanceof HumanTaskTransitionPolicyError
              ? 409
              : 503;
    const message =
      status === 503
        ? "Human Task status is temporarily unavailable."
        : error instanceof Error
          ? error.message
          : "Human Task status could not be changed.";
    return applyOpsCookies(
      NextResponse.json({ ok: false, error: message }, { status }),
      authorization.cookieResponse,
    );
  }
}
