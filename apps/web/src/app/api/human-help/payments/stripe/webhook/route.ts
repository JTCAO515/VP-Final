import { handleStripeWebhookPost } from "./handler";

export async function POST(request: Request) {
  return handleStripeWebhookPost(request);
}
