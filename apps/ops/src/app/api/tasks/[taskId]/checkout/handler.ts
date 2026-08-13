import {
  HumanTaskNotFoundError,
  HumanTaskPaymentAmountConflictError,
  HumanTaskPaymentStateError,
  HumanTaskTransitionForbiddenError,
  StripeCheckoutProviderError,
  type HumanTaskPaymentCheckoutService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../../../lib/opsAccess";
import { getHumanTaskPaymentCheckoutService } from "../../store";

const CheckoutRequestSchema = z
  .object({ amount_cents: z.number().int().positive().max(100_000_000) })
  .strict();

type RouteContext = { params: Promise<{ taskId: string }> };
type Dependencies = {
  authorize: (request: Request) => Promise<AuthorizedOpsRequest | NextResponse>;
  getCheckoutService: () => HumanTaskPaymentCheckoutService;
};

const defaultDependencies: Dependencies = {
  authorize: (request) => authorizeOpsRequest(request, "task.write"),
  getCheckoutService: getHumanTaskPaymentCheckoutService,
};

/**
 * Creates a hosted provider session for an already quoted task. This is intentionally an internal
 * Ops route: it does not make a traveller-facing payment promise and the response never includes
 * task contact or description.
 */
export async function handleTaskCheckoutPost(
  request: Request,
  context: RouteContext,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request);
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const { taskId } = await context.params;
    const input = CheckoutRequestSchema.parse(await request.json());
    const result = await dependencies.getCheckoutService().createCheckout({
      taskId,
      amountCents: input.amount_cents,
      actor: authorization.access,
    });
    return applyOpsCookies(
      NextResponse.json({
        ok: true,
        task: {
          id: result.task.id,
          status: result.task.status,
          price_usd: result.task.price_usd,
          updated_at: result.task.updated_at,
        },
        payment: {
          id: result.payment.id,
          status: result.payment.status,
          amount_cents: result.payment.amount_cents,
          currency: result.payment.currency,
          checkout_url: result.payment.checkout_url,
          retention_expires_at: result.payment.retention_expires_at,
        },
        replayed: result.replayed,
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
            : error instanceof HumanTaskPaymentStateError ||
                error instanceof HumanTaskPaymentAmountConflictError
              ? 409
              : error instanceof StripeCheckoutProviderError
                ? 502
                : 503;
    const message =
      status === 400
        ? "Checkout amount is invalid."
        : status === 403
          ? "You do not have permission to create this checkout."
          : status === 404
            ? "The requested task was not found."
            : status === 409
              ? "This task cannot create a checkout in its current state."
              : status === 502
                ? "Payment checkout is temporarily unavailable. No payment link was created."
                : status === 503
                  ? "Payment checkout is not configured. No payment link was created."
                  : "Payment checkout could not be created.";
    return applyOpsCookies(
      NextResponse.json({ ok: false, error: message }, { status }),
      authorization.cookieResponse,
    );
  }
}
