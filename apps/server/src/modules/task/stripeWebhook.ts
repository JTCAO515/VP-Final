import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;

const StripeCheckoutCompletedEventSchema = z
  .object({
    id: z.string().regex(/^evt_[A-Za-z0-9_]+$/),
    type: z.literal("checkout.session.completed"),
    data: z
      .object({
        object: z
          .object({
            id: z.string().regex(/^cs_[A-Za-z0-9_]+$/),
            client_reference_id: z.string().uuid(),
            payment_status: z.literal("paid"),
            payment_intent: z.string().regex(/^pi_[A-Za-z0-9_]+$/),
            amount_total: z.number().int().positive(),
            currency: z.literal("usd"),
            metadata: z.object({ visepanda_task_id: z.string().uuid() }).passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type StripeWebhookConfig = {
  signingSecret: string;
  toleranceSeconds: number;
};

export type VerifiedStripeCheckoutCompletedEvent = {
  providerEventId: string;
  providerCheckoutSessionId: string;
  providerPaymentIntentId: string;
  taskId: string;
  amountCents: number;
  currency: "usd";
};

export class StripeWebhookSignatureError extends Error {
  readonly code = "STRIPE_WEBHOOK_SIGNATURE_INVALID";

  constructor() {
    super("The payment provider signature could not be verified.");
    this.name = "StripeWebhookSignatureError";
  }
}

export class StripeWebhookPayloadError extends Error {
  readonly code = "STRIPE_WEBHOOK_PAYLOAD_INVALID";

  constructor() {
    super("The payment provider event is not an accepted Checkout completion.");
    this.name = "StripeWebhookPayloadError";
  }
}

export function resolveStripeWebhookConfig(environment: Environment): StripeWebhookConfig | null {
  if (environment.VISEPANDA_HUMAN_TASK_PAYMENTS_ENABLED !== "true") return null;
  const signingSecret = environment.STRIPE_WEBHOOK_SECRET?.trim();
  const toleranceSeconds = parseToleranceSeconds(
    environment.VISEPANDA_STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  );
  if (!signingSecret || toleranceSeconds === null) return null;
  return { signingSecret, toleranceSeconds };
}

/**
 * Verifies Stripe's signed raw body before JSON parsing. The returned data is deliberately a small,
 * validated projection; neither the raw provider payload nor the signature is returned for storage.
 */
export function verifyStripeCheckoutCompletedEvent(
  rawBody: string,
  signatureHeader: string | null,
  config: StripeWebhookConfig,
  now = new Date(),
): VerifiedStripeCheckoutCompletedEvent {
  const signature = parseSignatureHeader(signatureHeader);
  const signedPayload = `${signature.timestamp}.${rawBody}`;
  const expected = createHmac("sha256", config.signingSecret).update(signedPayload).digest();
  const receivedAt = now.getTime();
  if (
    !Number.isFinite(receivedAt) ||
    Math.abs(receivedAt - signature.timestamp * 1_000) > config.toleranceSeconds * 1_000 ||
    !signature.v1.some((candidate) => timingSafeHexEqual(expected, candidate))
  ) {
    throw new StripeWebhookSignatureError();
  }

  let parsed: z.infer<typeof StripeCheckoutCompletedEventSchema>;
  try {
    parsed = StripeCheckoutCompletedEventSchema.parse(JSON.parse(rawBody));
  } catch {
    throw new StripeWebhookPayloadError();
  }

  const checkout = parsed.data.object;
  if (checkout.client_reference_id !== checkout.metadata.visepanda_task_id) {
    throw new StripeWebhookPayloadError();
  }
  return {
    providerEventId: parsed.id,
    providerCheckoutSessionId: checkout.id,
    providerPaymentIntentId: checkout.payment_intent,
    taskId: checkout.client_reference_id,
    amountCents: checkout.amount_total,
    currency: checkout.currency,
  };
}

function parseSignatureHeader(value: string | null): { timestamp: number; v1: string[] } {
  if (!value) throw new StripeWebhookSignatureError();
  const entries = value.split(",").map((entry) => entry.trim().split("=", 2));
  const timestamps = entries.filter(([key]) => key === "t").map(([, candidate]) => candidate);
  const v1 = entries.filter(([key]) => key === "v1").map(([, candidate]) => candidate);
  if (
    timestamps.length !== 1 ||
    !timestamps[0] ||
    !/^\d+$/.test(timestamps[0]) ||
    v1.length === 0 ||
    v1.some((candidate) => !candidate || !/^[a-f0-9]{64}$/i.test(candidate))
  ) {
    throw new StripeWebhookSignatureError();
  }
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new StripeWebhookSignatureError();
  return { timestamp, v1: v1 as string[] };
}

function timingSafeHexEqual(expected: Buffer, candidate: string): boolean {
  const received = Buffer.from(candidate, "hex");
  return received.length === expected.length && timingSafeEqual(expected, received);
}

function parseToleranceSeconds(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return 300;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 30 && parsed <= 3_600 ? parsed : null;
}
