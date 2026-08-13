import { handleTaskCheckoutPost } from "./handler";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return handleTaskCheckoutPost(request, context);
}
