import {
  HumanTaskPaymentWebhookMismatchError,
  StripeWebhookPayloadError,
  StripeWebhookSignatureError,
  type HumanTaskPaymentWebhookService,
} from "@visepanda/app-server";
import { describe, expect, it, vi } from "vitest";
import { handleStripeWebhookPost } from "./handler";

const config = { signingSecret: "whsec_fixture_only", toleranceSeconds: 300 };
const event = {
  providerEventId: "evt_test_human_task_001",
  providerCheckoutSessionId: "cs_test_human_task_001",
  providerPaymentIntentId: "pi_test_human_task_001",
  taskId: "6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0",
  amountCents: 1499,
  currency: "usd" as const,
};

function request(body = "signed raw event", signature = "test-signature") {
  return new Request("https://web.example.com/api/human-help/payments/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

function service(): HumanTaskPaymentWebhookService {
  return {
    consumeVerifiedCheckout: vi.fn(async () => ({
      task: {} as never,
      payment: {} as never,
      replayed: false,
    })),
  };
}

describe("POST /api/human-help/payments/stripe/webhook", () => {
  it("uses the raw signed body and returns no ledger or provider details", async () => {
    const paymentService = service();
    const verify = vi.fn(() => event);
    const response = await handleStripeWebhookPost(request(), {
      resolveConfig: () => config,
      getService: () => paymentService,
      verify,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(verify).toHaveBeenCalledWith("signed raw event", "test-signature", config);
    expect(paymentService.consumeVerifiedCheckout).toHaveBeenCalledWith(event);
  });

  it("rejects an invalid signature before it calls the payment writer", async () => {
    const paymentService = service();
    const response = await handleStripeWebhookPost(request(), {
      resolveConfig: () => config,
      getService: () => paymentService,
      verify: () => {
        throw new StripeWebhookSignatureError();
      },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      received: false,
      error: "Invalid payment provider signature.",
    });
    expect(paymentService.consumeVerifiedCheckout).not.toHaveBeenCalled();
  });

  it("rejects a signed but unsupported provider event without calling the payment writer", async () => {
    const paymentService = service();
    const response = await handleStripeWebhookPost(request(), {
      resolveConfig: () => config,
      getService: () => paymentService,
      verify: () => {
        throw new StripeWebhookPayloadError();
      },
    });

    expect(response.status).toBe(400);
    expect(paymentService.consumeVerifiedCheckout).not.toHaveBeenCalled();
  });

  it("reports an unmatched verified event honestly without disclosing its provider fields", async () => {
    const response = await handleStripeWebhookPost(request(), {
      resolveConfig: () => config,
      getService: () => ({
        consumeVerifiedCheckout: async () => {
          throw new HumanTaskPaymentWebhookMismatchError();
        },
      }),
      verify: () => event,
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ received: false, error: "Payment event could not be applied." });
    expect(JSON.stringify(payload)).not.toContain(event.providerEventId);
    expect(JSON.stringify(payload)).not.toContain(event.providerPaymentIntentId);
  });

  it("fails closed without configured payment webhook credentials", async () => {
    const getService = vi.fn(service);
    const response = await handleStripeWebhookPost(request(), {
      resolveConfig: () => null,
      getService,
      verify: () => event,
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      received: false,
      code: "CAPABILITY_UNAVAILABLE",
      error: "Payment event processing is not configured.",
    });
    expect(getService).not.toHaveBeenCalled();
  });
});
