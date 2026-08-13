import { URL } from "node:url";
import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;
type FetchLike = typeof fetch;

const CheckoutSessionResponseSchema = z.object({
  id: z.string().regex(/^cs_[A-Za-z0-9_]+$/),
  url: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:"),
});

const CheckoutRequestSchema = z.object({
  taskId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_000),
});

export type StripeCheckoutConfig = {
  secretKey: string;
  successUrl: string;
  cancelUrl: string;
  retentionDays: number;
};

export type CreateStripeCheckoutSessionRequest = z.infer<typeof CheckoutRequestSchema>;
export type StripeCheckoutSession = z.infer<typeof CheckoutSessionResponseSchema>;

export type StripeCheckoutGateway = {
  createSession(request: CreateStripeCheckoutSessionRequest): Promise<StripeCheckoutSession>;
};

export class StripeCheckoutProviderError extends Error {
  readonly code = "STRIPE_CHECKOUT_UNAVAILABLE";

  constructor() {
    super("Payment checkout is temporarily unavailable.");
    this.name = "StripeCheckoutProviderError";
  }
}

/**
 * Payment activation is explicit. A false, absent, or malformed configuration never falls back to
 * a local success path because a Human Task may not enter payment_pending without a durable provider
 * session in the later writer boundary.
 */
export function resolveStripeCheckoutConfig(environment: Environment): StripeCheckoutConfig | null {
  if (environment.VISEPANDA_HUMAN_TASK_PAYMENTS_ENABLED !== "true") return null;

  const secretKey = environment.STRIPE_SECRET_KEY?.trim();
  const successUrl = parseHttpsUrl(environment.VISEPANDA_STRIPE_SUCCESS_URL);
  const cancelUrl = parseHttpsUrl(environment.VISEPANDA_STRIPE_CANCEL_URL);
  const retentionDays = parsePositiveInteger(environment.VISEPANDA_PAYMENT_RETENTION_DAYS);

  if (!secretKey || !successUrl || !cancelUrl || !retentionDays) return null;
  return { secretKey, successUrl, cancelUrl, retentionDays };
}

export function createStripeCheckoutGateway(
  config: StripeCheckoutConfig,
  fetchImpl: FetchLike = fetch,
): StripeCheckoutGateway {
  return {
    async createSession(input) {
      const request = CheckoutRequestSchema.parse(input);
      const body = new URLSearchParams({
        mode: "payment",
        success_url: config.successUrl,
        cancel_url: config.cancelUrl,
        client_reference_id: request.taskId,
        "metadata[visepanda_task_id]": request.taskId,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(request.amountCents),
        "line_items[0][price_data][product_data][name]": "VisePanda Human Help",
        "line_items[0][quantity]": "1",
      });

      let response: Response;
      try {
        response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        });
      } catch {
        throw new StripeCheckoutProviderError();
      }

      if (!response.ok) throw new StripeCheckoutProviderError();

      try {
        return CheckoutSessionResponseSchema.parse(await response.json());
      } catch {
        throw new StripeCheckoutProviderError();
      }
    },
  };
}

function parseHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 3_650 ? parsed : null;
}
