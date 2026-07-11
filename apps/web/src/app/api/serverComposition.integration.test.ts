import { describe, expect, it } from "vitest";
import { createWebServerServices } from "./_server";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Web durable server composition", () => {
  it("retains Trip and Knowledge writes across composition re-instantiation", async () => {
    const environment = {
      VISEPANDA_RUNTIME_MODE: "preview",
      DATABASE_URL: databaseUrl,
    };
    const identity = {
      kind: "anonymous" as const,
      anonId: `web-cold-start-${crypto.randomUUID()}`,
    };
    const trip = {
      id: crypto.randomUUID(),
      title: "Cold start proof",
      destinationCountry: "CN" as const,
      days: [],
    };
    const question = `Cold start knowledge gap ${crypto.randomUUID()}`;

    const first = createWebServerServices(environment);
    await first.tripService.create(trip, identity, "user_manual");
    const gap = await first.knowledgeService.recordGap({ question, city: "Shanghai" });

    const second = createWebServerServices(environment);
    await expect(second.tripService.get(trip.id, identity)).resolves.toMatchObject({
      trip,
      version: 1,
    });
    await expect(second.knowledgeService.listGaps()).resolves.toContainEqual(
      expect.objectContaining({ id: gap.id, city: "Shanghai" }),
    );
  });
});
