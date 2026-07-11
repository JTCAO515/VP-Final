import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryHumanTaskService } from "./service.js";

describe("task router", () => {
  it("fails closed when the composition root omits Human Task", async () => {
    const caller = appRouter.createCaller({ tripService: createVersionedInMemoryTripService() });

    await expect(caller.task.list()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Human Task is unavailable.",
    });
  });

  it("creates a human task request", async () => {
    const caller = appRouter.createCaller({
      humanTaskService: createInMemoryHumanTaskService(),
      tripService: createVersionedInMemoryTripService(),
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
