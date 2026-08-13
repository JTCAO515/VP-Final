import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  resolveStripeWebhookConfig,
  StripeWebhookPayloadError,
  StripeWebhookSignatureError,
  verifyStripeCheckoutCompletedEvent,
} from "./stripeWebhook.js";

const signingSecret = "whsec_fixture_only_not_a_live_secret";
const timestamp = 1_700_000_000;
const body = JSON.stringify({
  id: "evt_test_human_task_001",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_human_task_001",
      client_reference_id: "6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0",
      payment_status: "paid",
      payment_intent: "pi_test_human_task_001",
      amount_total: 1499,
      currency: "usd",
      metadata: { visepanda_task_id: "6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0" },
      traveler_message: "must not leave the verifier",
    },
  },
});
const environment = {
  VISEPANDA_HUMAN_TASK_PAYMENTS_ENABLED: "true",
  STRIPE_WEBHOOK_SECRET: signingSecret,
} as const;

describe("Stripe webhook configuration", () => {
  it("remains unavailable unless payment activation and a signing secret are present", () => {
    expect(resolveStripeWebhookConfig({})).toBeNull();
    expect(
      resolveStripeWebhookConfig({
        ...environment,
        VISEPANDA_HUMAN_TASK_PAYMENTS_ENABLED: "false",
      }),
    ).toBeNull();
    expect(
      resolveStripeWebhookConfig({
        ...environment,
        VISEPANDA_STRIPE_WEBHOOK_TOLERANCE_SECONDS: "5",
      }),
    ).toBeNull();
  });
});

describe("Stripe Checkout webhook verifier", () => {
  it("accepts a current valid signature and returns only the durable payment projection", () => {
    const config = resolveStripeWebhookConfig(environment);
    if (!config) throw new Error("fixture configuration must resolve");

    const event = verifyStripeCheckoutCompletedEvent(
      body,
      signatureFor(body, timestamp),
      config,
      new Date(timestamp * 1_000 + 60_000),
    );

    expect(event).toEqual({
      providerEventId: "evt_test_human_task_001",
      providerCheckoutSessionId: "cs_test_human_task_001",
      providerPaymentIntentId: "pi_test_human_task_001",
      taskId: "6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0",
      amountCents: 1499,
      currency: "usd",
    });
    expect(JSON.stringify(event)).not.toContain("traveler_message");
  });

  it("rejects a stale or malformed signature before it parses the provider body", () => {
    const config = resolveStripeWebhookConfig(environment);
    if (!config) throw new Error("fixture configuration must resolve");

    expect(() =>
      verifyStripeCheckoutCompletedEvent(
        body,
        "t=1700000000,v1=not-a-real-hmac",
        config,
        new Date(timestamp * 1_000),
      ),
    ).toThrow(StripeWebhookSignatureError);
    expect(() =>
      verifyStripeCheckoutCompletedEvent(
        "not-json",
        signatureFor("not-json", timestamp),
        config,
        new Date(timestamp * 1_000 + 301_000),
      ),
    ).toThrow(StripeWebhookSignatureError);
  });

  it("rejects a signed payload whose task references disagree", () => {
    const config = resolveStripeWebhookConfig(environment);
    if (!config) throw new Error("fixture configuration must resolve");
    const mismatched = body.replace(
      '6b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0"}',
      '7b42f7b2-75e4-4a9e-890a-6ca4fc29e8a0"}',
    );

    expect(() =>
      verifyStripeCheckoutCompletedEvent(
        mismatched,
        signatureFor(mismatched, timestamp),
        config,
        new Date(timestamp * 1_000),
      ),
    ).toThrow(StripeWebhookPayloadError);
  });
});

function signatureFor(payload: string, signedAt: number): string {
  const signature = createHmac("sha256", signingSecret)
    .update(`${signedAt}.${payload}`)
    .digest("hex");
  return `t=${signedAt},v1=${signature}`;
}
