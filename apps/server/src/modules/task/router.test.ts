import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryHumanTaskService } from "./service.js";

describe("task router", () => {
  it("fails closed when the composition root omits Human Task", async () => {
    const caller = appRouter.createCaller({
      identity: { kind: "anonymous", anonId: "anon-a" },
      tripService: createVersionedInMemoryTripService(),
    });

    await expect(caller.task.listMine()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Human Task is unavailable.",
    });
  });

  it("requires trusted identity and creates only an owner-scoped request", async () => {
    const humanTaskService = createInMemoryHumanTaskService();
    const unauthenticated = appRouter.createCaller({
      humanTaskService,
      identity: { kind: "none" },
      tripService: createVersionedInMemoryTripService(),
    });
    await expect(
      unauthenticated.task.create({
        city: "Shanghai",
        kind: "ticket_help",
        description: "Please help check ticket requirements for this passport booking.",
        contact: "traveler@example.com",
        idempotency_key: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const caller = appRouter.createCaller({
      humanTaskService,
      identity: { kind: "anonymous", anonId: "anon-a" },
      tripService: createVersionedInMemoryTripService(),
    });

    const task = await caller.task.create({
      city: "Shanghai",
      kind: "ticket_help",
      description: "Please help check ticket requirements for this passport booking.",
      contact: "traveler@example.com",
      idempotency_key: "00000000-0000-4000-8000-000000000001",
    });

    expect(task.status).toBe("requested");
    expect(await caller.task.listMine()).toHaveLength(1);
  });
});
