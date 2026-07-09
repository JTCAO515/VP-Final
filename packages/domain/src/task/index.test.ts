import { describe, expect, it } from "vitest";
import { HumanTaskSchema, createHumanTask, updateHumanTask } from "./index.js";

describe("human task domain", () => {
  it("creates a requested task", () => {
    const task = createHumanTask(
      {
        city: "Shanghai",
        kind: "call_restaurant",
        description: "Please call a restaurant to confirm the reservation flow.",
        contact: "traveler@example.com",
      },
      new Date("2026-07-09T00:00:00.000Z"),
    );

    expect(task.status).toBe("requested");
    expect(task.created_at).toBe("2026-07-09T00:00:00.000Z");
  });

  it("accepts the full concierge status machine", () => {
    for (const status of [
      "requested",
      "triaged",
      "quoted",
      "payment_pending",
      "paid",
      "fulfilling",
      "done",
      "cancelled",
    ]) {
      expect(
        HumanTaskSchema.parse({
          id: `task-${status}`,
          city: "Beijing",
          kind: "ticket_help",
          description: "Help confirm ticket requirements for a passport booking.",
          contact: "traveler@example.com",
          status,
          created_at: "2026-07-09T00:00:00.000Z",
          updated_at: "2026-07-09T00:00:00.000Z",
        }).status,
      ).toBe(status);
    }
  });

  it("updates manual quote fields", () => {
    const task = createHumanTask({
      city: "Chengdu",
      kind: "other",
      description: "Please help confirm whether this spa can serve English speakers.",
      contact: "traveler@example.com",
    });

    const updated = updateHumanTask(task, {
      status: "quoted",
      price_usd: 24,
      payment_link: "https://buy.stripe.com/test",
      operator_note: "Manual quote prepared.",
    });

    expect(updated.status).toBe("quoted");
    expect(updated.payment_link).toBe("https://buy.stripe.com/test");
  });
});
