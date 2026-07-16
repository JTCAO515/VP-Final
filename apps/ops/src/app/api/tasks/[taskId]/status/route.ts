import { handleTaskStatusPatch } from "./handler";

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return handleTaskStatusPatch(request, context);
}
