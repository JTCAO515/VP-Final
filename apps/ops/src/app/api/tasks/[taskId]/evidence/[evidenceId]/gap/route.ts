import { handleGapProposal } from "./handler";

type RouteContext = { params: Promise<{ taskId: string; evidenceId: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleGapProposal(request, context);
}
