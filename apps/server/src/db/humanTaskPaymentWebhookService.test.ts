import { describe, expect, it } from "vitest";
import {
  HumanTaskPaymentWebhookMismatchError,
  HumanTaskPaymentWebhookStateError,
  resolveVerifiedPaymentDisposition,
} from "./humanTaskPaymentWebhookService.js";

const event = {
  providerEventId: "evt_test_human_task_001",
  providerCheckoutSessionId: "cs_test_human_task_001",
  providerPaymentIntentId: "pi_test_human_task_001",
  taskId: "6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0",
  amountCents: 1499,
  currency: "usd" as const,
};

const openPayment = {
  provider: "stripe" as const,
  provider_checkout_session_id: event.providerCheckoutSessionId,
  provider_payment_intent_id: null,
  provider_event_id: null,
  amount_cents: event.amountCents,
  currency: "usd" as const,
  status: "checkout_open" as const,
};

describe("verified Human Task payment disposition", () => {
  it("accepts only a matching open Stripe Checkout ledger row for application", () => {
    expect(resolveVerifiedPaymentDisposition(openPayment, event)).toBe("apply");
  });

  it("permits a replay only for the exact event and payment intent already recorded as paid", () => {
    expect(
      resolveVerifiedPaymentDisposition(
        {
          ...openPayment,
          provider_payment_intent_id: event.providerPaymentIntentId,
          provider_event_id: event.providerEventId,
          status: "paid",
        },
        event,
      ),
    ).toBe("replay");

    expect(() =>
      resolveVerifiedPaymentDisposition(
        {
          ...openPayment,
          provider_payment_intent_id: event.providerPaymentIntentId,
          provider_event_id: "evt_test_human_task_other",
          status: "paid",
        },
        event,
      ),
    ).toThrow(HumanTaskPaymentWebhookMismatchError);
  });

  it("fails closed for mismatched session, amount, or non-open payment state", () => {
    expect(() =>
      resolveVerifiedPaymentDisposition({ ...openPayment, amount_cents: 1500 }, event),
    ).toThrow(HumanTaskPaymentWebhookMismatchError);
    expect(() =>
      resolveVerifiedPaymentDisposition(
        { ...openPayment, provider_checkout_session_id: "cs_test_other" },
        event,
      ),
    ).toThrow(HumanTaskPaymentWebhookMismatchError);
    expect(() =>
      resolveVerifiedPaymentDisposition({ ...openPayment, status: "expired" }, event),
    ).toThrow(HumanTaskPaymentWebhookStateError);
  });
});
