import { describe, expect, it } from "vitest";
import { createOpsHumanTaskService } from "./store";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Ops durable Human Task composition", () => {
  it("retains a request across composition re-instantiation", async () => {
    const environment = { VISEPANDA_RUNTIME_MODE: "preview", DATABASE_URL: databaseUrl };
    const idempotencyKey = crypto.randomUUID();
    const identity = { kind: "anonymous" as const, anonId: randomAnonId() };

    const first = createOpsHumanTaskService(environment);
    const task = await first.create({
      identity,
      idempotencyKey,
      request: {
        city: "Shanghai",
        kind: "other",
        description: "Please verify this durable Ops queue integration request for the preview.",
        contact: "ops-test@example.com",
      },
    });
    const second = createOpsHumanTaskService(environment);

    await expect(second.listForOps()).resolves.toContainEqual(
      expect.objectContaining({ id: task.id }),
    );
  });
});

function randomAnonId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}
