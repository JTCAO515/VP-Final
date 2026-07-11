import { describe, expect, it } from "vitest";
import { createOpsKnowledgeService } from "./store";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Ops durable Knowledge composition", () => {
  it("retains a gap across composition re-instantiation", async () => {
    const environment = {
      VISEPANDA_RUNTIME_MODE: "preview",
      DATABASE_URL: databaseUrl,
    };
    const question = `Ops cold start gap ${crypto.randomUUID()}`;

    const first = createOpsKnowledgeService(environment);
    const gap = await first.recordGap({ question, city: "Beijing" });
    const second = createOpsKnowledgeService(environment);

    await expect(second.listGaps()).resolves.toContainEqual(
      expect.objectContaining({ id: gap.id, city: "Beijing" }),
    );
  });
});
