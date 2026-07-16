import { describe, expect, it, vi } from "vitest";
import {
  CompletionQueueUnavailableError,
  createQStashCompletionQueue,
  resolveQStashCompletionQueueConfig,
} from "./completionQueue.js";

const config = {
  token: "test-token",
  currentSigningKey: "test-current",
  nextSigningKey: "test-next",
  callbackUrl: "https://preview.example.com/api/copilot/complete/callback",
};
const payload = {
  jobId: "20000000-0000-0000-0000-000000000001",
  idempotencyKey: "20000000-0000-0000-0000-000000000002",
};

describe("QStash completion queue", () => {
  it("fails honestly when any required configuration is missing", () => {
    expect(() => resolveQStashCompletionQueueConfig({ QSTASH_TOKEN: "configured" })).toThrow(
      CompletionQueueUnavailableError,
    );
  });

  it("rejects identity or Trip data outside the minimized delivery contract", async () => {
    const queue = createQStashCompletionQueue(config, {
      publishJSON: vi.fn(async () => undefined),
    });
    await expect(
      queue.publish({ ...payload, userId: "forbidden" } as typeof payload, 1),
    ).rejects.toThrow();
  });

  it("publishes only the frozen delivery payload with per-attempt deduplication", async () => {
    const publishJSON = vi.fn(async () => ({ messageId: "message-1" }));
    const queue = createQStashCompletionQueue(config, { publishJSON });

    await queue.publish(payload, 1);

    expect(publishJSON).toHaveBeenCalledWith({
      url: config.callbackUrl,
      body: payload,
      deduplicationId: `${payload.jobId}:1`,
      retries: 3,
      timeout: "5m",
      redact: { body: true },
    });
  });

  it("returns false for an invalid signature without throwing", async () => {
    const queue = createQStashCompletionQueue(config, {
      verify: vi.fn(async () => {
        throw new Error("invalid signature");
      }),
    });

    await expect(queue.verify(JSON.stringify(payload), "invalid")).resolves.toBe(false);
  });
});
