import { Client, Receiver } from "@upstash/qstash";
import { z } from "zod";

export const CompletionDeliverySchema = z
  .object({
    jobId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export type CompletionDelivery = z.infer<typeof CompletionDeliverySchema>;

export interface CompletionQueue {
  publish(payload: CompletionDelivery, deliveryAttempt: number): Promise<void>;
  verify(rawBody: string, signature: string): Promise<boolean>;
}

export type QStashCompletionQueueConfig = {
  token: string;
  currentSigningKey: string;
  nextSigningKey: string;
  callbackUrl: string;
};

export class CompletionQueueUnavailableError extends Error {
  readonly code = "COMPLETION_QUEUE_UNAVAILABLE";

  constructor(readonly missing: string[]) {
    super("Durable trip completion is not configured.");
    this.name = "CompletionQueueUnavailableError";
  }
}

export function resolveQStashCompletionQueueConfig(
  environment: Readonly<Record<string, string | undefined>>,
): QStashCompletionQueueConfig {
  const names = [
    "QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "COPILOT_COMPLETION_CALLBACK_URL",
  ] as const;
  const missing = names.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) throw new CompletionQueueUnavailableError([...missing]);

  return {
    token: environment.QSTASH_TOKEN!,
    currentSigningKey: environment.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: environment.QSTASH_NEXT_SIGNING_KEY!,
    callbackUrl: z.string().url().parse(environment.COPILOT_COMPLETION_CALLBACK_URL),
  };
}

export function createQStashCompletionQueue(
  config: QStashCompletionQueueConfig,
  dependencies: {
    publishJSON?: (request: {
      url: string;
      body: CompletionDelivery;
      deduplicationId: string;
      retries: number;
      timeout: "5m";
      redact: { body: true };
    }) => Promise<unknown>;
    verify?: (request: { signature: string; body: string; url: string }) => Promise<boolean>;
  } = {},
): CompletionQueue {
  const client = new Client({ token: config.token });
  const receiver = new Receiver({
    currentSigningKey: config.currentSigningKey,
    nextSigningKey: config.nextSigningKey,
  });
  const publishJSON = dependencies.publishJSON ?? ((request) => client.publishJSON(request));
  const verify = dependencies.verify ?? ((request) => receiver.verify(request));

  return {
    async publish(payload, deliveryAttempt) {
      const parsed = CompletionDeliverySchema.parse(payload);
      await publishJSON({
        url: config.callbackUrl,
        body: parsed,
        deduplicationId: `${parsed.jobId}:${deliveryAttempt}`,
        retries: 3,
        timeout: "5m",
        redact: { body: true },
      });
    },

    async verify(rawBody, signature) {
      if (!signature) return false;
      try {
        return await verify({ signature, body: rawBody, url: config.callbackUrl });
      } catch {
        return false;
      }
    },
  };
}
