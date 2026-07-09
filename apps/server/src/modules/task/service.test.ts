import { describe, expect, it } from "vitest";
import { createInMemoryHumanTaskService } from "./service.js";

describe("human task service", () => {
  it("creates and updates concierge tasks", async () => {
    const service = createInMemoryHumanTaskService();

    const task = await service.create({
      city: "Shanghai",
      kind: "call_restaurant",
      description: "Please call to confirm whether this restaurant accepts foreign cards.",
      contact: "traveler@example.com",
    });

    expect(await service.list()).toHaveLength(1);

    const updated = await service.update({
      id: task.id,
      status: "quoted",
      price_usd: 19,
      payment_link: "https://buy.stripe.com/manual",
    });

    expect(updated.status).toBe("quoted");
    expect(updated.price_usd).toBe(19);
  });
});
