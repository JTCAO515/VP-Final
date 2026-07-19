import type { HumanTaskService, KnowledgeService } from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { SensitiveHumanTaskEvidenceError } from "@visepanda/domain";
import { z } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../../../../../lib/opsAccess";
import { getKnowledgeService } from "../../../../../knowledge/store";
import { getHumanTaskService } from "../../../../store";

type RouteContext = { params: Promise<{ taskId: string; evidenceId: string }> };
type Dependencies = {
  authorize: (
    request: Request,
    permission: "task.write",
  ) => Promise<AuthorizedOpsRequest | NextResponse>;
  getTaskService: () => HumanTaskService;
  getKnowledgeService: () => KnowledgeService;
};
const ProposalSchema = z.object({ question_pattern: z.string().trim().min(10).max(500) });
const defaultDependencies: Dependencies = {
  authorize: authorizeOpsRequest,
  getTaskService: getHumanTaskService,
  getKnowledgeService,
};

export async function handleGapProposal(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "task.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const { taskId, evidenceId } = await context.params;
    const proposal = ProposalSchema.parse(await request.json());
    const taskService = dependencies.getTaskService();
    const evidence = await taskService.listEvidence(taskId, authorization.access);
    if (!evidence.some((item) => item.id === evidenceId)) {
      return NextResponse.json({ ok: false, error: "Evidence not found." }, { status: 404 });
    }
    const task = await taskService.getForOps(taskId, authorization.access);
    const gap = await dependencies.getKnowledgeService().recordEvidenceGap({
      question: proposal.question_pattern,
      city: task.city,
      actorId: authorization.access.userId,
      taskId,
      evidenceId,
    });
    return applyOpsCookies(NextResponse.json({ ok: true, gap }), authorization.cookieResponse);
  } catch (error) {
    const status =
      error instanceof z.ZodError || error instanceof SyntaxError
        ? 400
        : error instanceof SensitiveHumanTaskEvidenceError
          ? 409
          : 503;
    return NextResponse.json(
      {
        ok: false,
        error:
          status === 400
            ? "Enter a reusable gap pattern."
            : status === 409
              ? error instanceof Error
                ? error.message
                : "Remove personal or sensitive data before proposing this gap."
              : "Gap proposal is temporarily unavailable.",
      },
      { status },
    );
  }
}
