import { describe, expect, it } from "vitest";
import { listTasks, updateTask } from "./store";

describe("ops human task store", () => {
  it("updates task status and manual payment link", () => {
    const task = listTasks()[0];
    expect(task).toBeDefined();

    const updated = updateTask({
      id: task!.id,
      status: "quoted",
      price_usd: 29,
      payment_link: "https://buy.stripe.com/manual",
      operator_note: "Ready to send.",
    });

    expect(updated.status).toBe("quoted");
    expect(updated.payment_link).toBe("https://buy.stripe.com/manual");
  });
});
