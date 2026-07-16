import { describe, expect, it } from "vitest";
import {
  HumanTaskCapacityError,
  HumanTaskIdempotencyConflictError,
  HumanTaskPreviewScopeError,
  createInMemoryHumanTaskService,
} from "./service.js";

const anonA = { kind: "anonymous" as const, anonId: "anon-a" };
const anonB = { kind: "anonymous" as const, anonId: "anon-b" };
const request = {
  city: "Shanghai",
  kind: "call_restaurant" as const,
  description: "Please call to confirm whether this restaurant accepts foreign cards.",
  contact: "traveler@example.com",
};

describe("human task service", () => {
  it("creates an owner-scoped request and replays one idempotency key once", async () => {
    const service = createInMemoryHumanTaskService();
    const command = {
      identity: anonA,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      request,
    };

    const task = await service.create(command);
    await expect(service.create(command)).resolves.toEqual(task);
    await expect(
      service.create({
        ...command,
        request: { ...request, contact: "different@example.com" },
      }),
    ).rejects.toBeInstanceOf(HumanTaskIdempotencyConflictError);
    await expect(service.listForOwner(anonA)).resolves.toEqual([task]);
    await expect(service.listForOwner(anonB)).resolves.toEqual([]);
    await expect(service.listForOps()).resolves.toEqual([task]);
    await expect(
      service.create({
        ...command,
        identity: anonB,
      }),
    ).rejects.toBeInstanceOf(HumanTaskIdempotencyConflictError);
  });

  it("enforces the controlled-preview city and durable daily capacity", async () => {
    const service = createInMemoryHumanTaskService({
      now: () => new Date("2026-07-16T04:00:00.000Z"),
    });

    await expect(
      service.create({
        identity: anonA,
        idempotencyKey: "00000000-0000-4000-8000-000000000010",
        request: { ...request, city: "Beijing" },
      }),
    ).rejects.toBeInstanceOf(HumanTaskPreviewScopeError);

    for (let index = 0; index < 5; index += 1) {
      await service.create({
        identity: anonA,
        idempotencyKey: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        request,
      });
    }

    await expect(
      service.create({
        identity: anonA,
        idempotencyKey: "00000000-0000-4000-8000-000000000099",
        request,
      }),
    ).rejects.toBeInstanceOf(HumanTaskCapacityError);
  });
});
