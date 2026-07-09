import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createInMemoryHumanTaskService } from "./service.js";

describe("task router", () => {
  it("creates a human task request", async () => {
    const caller = appRouter.createCaller({
      humanTaskService: createInMemoryHumanTaskService(),
      tripService: undefined as never,
    });

    const task = await caller.task.create({
      city: "Beijing",
      kind: "ticket_help",
      description: "Please help check ticket requirements for this passport booking.",
      contact: "traveler@example.com",
    });

    expect(task.status).toBe("requested");
    expect(await caller.task.list()).toHaveLength(1);
  });
});
