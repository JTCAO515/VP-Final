import {
  HumanTaskNotFoundError,
  HumanTaskPaymentWebhookMismatchError,
  HumanTaskPaymentWebhookStateError,
  resolveStripeWebhookConfig,
  StripeWebhookPayloadError,
  StripeWebhookSignatureError,
  verifyStripeCheckoutCompletedEvent,
  type HumanTaskPaymentWebhookService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { getHumanTaskPaymentWebhookService } from "../../../../_server";
import { runtimeUnavailableResponse } from "../../../../_runtimeError";

type Dependencies = {
  resolveConfig: typeof resolveStripeWebhookConfig;
  getService: () => HumanTaskPaymentWebhookService;
  verify: typeof verifyStripeCheckoutCompletedEvent;
};

const defaultDependencies: Dependencies = {
  resolveConfig: resolveStripeWebhookConfig,
  getService: getHumanTaskPaymentWebhookService,
  verify: verifyStripeCheckoutCompletedEvent,
};

/**
 * Public provider boundary: it reads the exact raw body once, verifies it before JSON parsing, and
 * returns no task, payment, provider id, signature, or raw-payload data to the caller.
 */
export async function handleStripeWebhookPost(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
): Promise<NextResponse> {
  const rawBody = await request.text();
  const config = dependencies.resolveConfig(process.env);
  if (!config) return unavailable();

  try {
    const event = dependencies.verify(rawBody, request.headers.get("stripe-signature"), config);
    await dependencies.getService().consumeVerifiedCheckout(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    const runtimeUnavailable = runtimeUnavailableResponse(error);
    if (runtimeUnavailable) return runtimeUnavailable;
    if (error instanceof StripeWebhookSignatureError) {
      return NextResponse.json(
        { received: false, error: "Invalid payment provider signature." },
        { status: 401 },
      );
    }
    if (error instanceof StripeWebhookPayloadError) {
      return NextResponse.json(
        { received: false, error: "Unsupported payment provider event." },
        { status: 400 },
      );
    }
    if (
      error instanceof HumanTaskNotFoundError ||
      error instanceof HumanTaskPaymentWebhookMismatchError ||
      error instanceof HumanTaskPaymentWebhookStateError
    ) {
      return NextResponse.json(
        { received: false, error: "Payment event could not be applied." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { received: false, error: "Payment event processing is temporarily unavailable." },
      { status: 503 },
    );
  }
}

function unavailable(): NextResponse {
  return NextResponse.json(
    {
      received: false,
      code: "CAPABILITY_UNAVAILABLE",
      error: "Payment event processing is not configured.",
    },
    { status: 503 },
  );
}
