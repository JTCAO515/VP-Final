import { handleTaskDetailGet, handleTaskNotePatch } from "./handler";

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return handleTaskDetailGet(request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return handleTaskNotePatch(request, context);
}
