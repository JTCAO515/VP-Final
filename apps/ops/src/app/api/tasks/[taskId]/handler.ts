import {
  HumanTaskEvidencePolicyError,
  HumanTaskNotFoundError,
  HumanTaskTransitionForbiddenError,
} from "@visepanda/app-server";
import {
  HumanTaskEvidenceInputSchema,
  HumanTaskUpdateSchema,
  SensitiveHumanTaskEvidenceError,
  canAppendHumanTaskEvidence,
  type HumanTaskStatus,
} from "@visepanda/domain";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../../lib/opsAccess";
import { getHumanTaskService } from "../store";

type RouteContext = { params: Promise<{ taskId: string }> };
type Dependencies = {
  authorize: (
    request: Request,
    permission: "task.contact.read" | "task.write",
  ) => Promise<AuthorizedOpsRequest | NextResponse>;
  getService: typeof getHumanTaskService;
};

const defaultDependencies: Dependencies = {
  authorize: authorizeOpsRequest,
  getService: getHumanTaskService,
};

export async function handleTaskDetailGet(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "task.contact.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const { taskId } = await context.params;
    const service = dependencies.getService();
    const [task, transitions, evidence] = await Promise.all([
      service.getForOps(taskId, authorization.access),
      service.listTransitions(taskId, authorization.access),
      service.listEvidence(taskId, authorization.access),
    ]);
    return applyOpsCookies(
      NextResponse.json({
        ok: true,
        task,
        transitions,
        evidence,
        evidence_writable: canAppendHumanTaskEvidence(task.status),
        allowed_transitions: previewTransitions(task.status),
      }),
      authorization.cookieResponse,
    );
  } catch (error) {
    return taskErrorResponse(error, authorization.cookieResponse, "detail");
  }
}

export async function handleTaskEvidencePost(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "task.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const { taskId } = await context.params;
    const evidence = await dependencies.getService().appendEvidence({
      taskId,
      actor: authorization.access,
      evidence: HumanTaskEvidenceInputSchema.parse(await request.json()),
    });
    return applyOpsCookies(NextResponse.json({ ok: true, evidence }), authorization.cookieResponse);
  } catch (error) {
    return taskErrorResponse(error, authorization.cookieResponse, "evidence");
  }
}

export async function handleTaskNotePatch(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "task.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const { taskId } = await context.params;
    const update = HumanTaskUpdateSchema.pick({ operator_note: true })
      .required()
      .parse(await request.json());
    const task = await dependencies.getService().updateOperatorNote({
      taskId,
      actor: authorization.access,
      note: update.operator_note,
    });
    return applyOpsCookies(
      NextResponse.json({
        ok: true,
        note: task.operator_note,
        updated_at: task.updated_at,
      }),
      authorization.cookieResponse,
    );
  } catch (error) {
    return taskErrorResponse(error, authorization.cookieResponse, "note");
  }
}

function previewTransitions(status: HumanTaskStatus): HumanTaskStatus[] {
  if (status === "requested") return ["triaged", "cancelled"];
  if (status === "triaged") return ["cancelled"];
  return [];
}

function taskErrorResponse(
  error: unknown,
  cookies: NextResponse,
  operation: "detail" | "note" | "evidence",
) {
  const status =
    error instanceof ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof HumanTaskTransitionForbiddenError
        ? 403
        : error instanceof HumanTaskNotFoundError
          ? 404
          : error instanceof HumanTaskEvidencePolicyError ||
              error instanceof SensitiveHumanTaskEvidenceError
            ? 409
            : 503;
  const message =
    status === 503
      ? `Human Task ${operation} is temporarily unavailable.`
      : error instanceof Error
        ? error.message
        : `Human Task ${operation} could not be loaded.`;
  return applyOpsCookies(NextResponse.json({ ok: false, error: message }, { status }), cookies);
}
