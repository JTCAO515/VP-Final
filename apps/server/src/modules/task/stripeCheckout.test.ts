import { describe, expect, it, vi } from "vitest";
import {
  createStripeCheckoutGateway,
  resolveStripeCheckoutConfig,
  StripeCheckoutProviderError,
} from "./stripeCheckout.js";

const environment = {
  VISEPANDA_HUMAN_TASK_PAYMENTS_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_fixture_only",
  VISEPANDA_STRIPE_SUCCESS_URL: "https://www.go2china.space/payment/success",
  VISEPANDA_STRIPE_CANCEL_URL: "https://www.go2china.space/payment/cancel",
  VISEPANDA_PAYMENT_RETENTION_DAYS: "400",
} as const;

describe("Stripe Checkout configuration", () => {
  it("remains unavailable until payment activation and every required setting are valid", () => {
    expect(resolveStripeCheckoutConfig({})).toBeNull();
    expect(
      resolveStripeCheckoutConfig({
        ...environment,
        VISEPANDA_HUMAN_TASK_PAYMENTS_ENABLED: "false",
      }),
    ).toBeNull();
    expect(
      resolveStripeCheckoutConfig({
        ...environment,
        VISEPANDA_STRIPE_SUCCESS_URL: "http://example.test/success",
      }),
    ).toBeNull();
    expect(
      resolveStripeCheckoutConfig({
        ...environment,
        VISEPANDA_PAYMENT_RETENTION_DAYS: "0",
      }),
    ).toBeNull();
  });
});

describe("Stripe Checkout gateway", () => {
  it("creates a hosted one-time Checkout session with only the task reference and amount", async () => {
    let capturedRequest: { url: string; init: RequestInit | undefined } | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedRequest = { url: String(input), init };
      return new Response(
        JSON.stringify({
          id: "cs_test_checkout_123",
          url: "https://checkout.stripe.com/c/pay/cs_test_checkout_123",
        }),
        { status: 200 },
      );
    };
    const config = resolveStripeCheckoutConfig(environment);
    if (!config) throw new Error("fixture configuration must resolve");
    const gateway = createStripeCheckoutGateway(config, fetchImpl);

    await expect(
      gateway.createSession({
        taskId: "6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0",
        amountCents: 1499,
      }),
    ).resolves.toEqual({
      id: "cs_test_checkout_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_checkout_123",
    });

    expect(capturedRequest?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(capturedRequest?.init).toMatchObject({ method: "POST" });
    const form = new URLSearchParams(String(capturedRequest?.init?.body));
    expect(form.get("client_reference_id")).toBe("6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0");
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("1499");
    expect(String(capturedRequest?.init?.body)).not.toMatch(/card|passport|contact|description/i);
  });

  it("returns a generic unavailable error when Stripe rejects or malforms a response", async () => {
    const config = resolveStripeCheckoutConfig(environment);
    if (!config) throw new Error("fixture configuration must resolve");
    const gateway = createStripeCheckoutGateway(
      config,
      vi.fn(
        async () => new Response('{"error":{"message":"do not expose"}}', { status: 500 }),
      ) as unknown as typeof fetch,
    );

    await expect(
      gateway.createSession({
        taskId: "6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0",
        amountCents: 1499,
      }),
    ).rejects.toBeInstanceOf(StripeCheckoutProviderError);
  });
});
