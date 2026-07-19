import { describe, expect, it } from "vitest";
import {
  HumanTaskCapacityError,
  HumanTaskIdempotencyConflictError,
  HumanTaskPreviewScopeError,
  HumanTaskTransitionForbiddenError,
  HumanTaskTransitionPolicyError,
  HumanTaskEvidencePolicyError,
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
const operator = {
  userId: "00000000-0000-4000-8000-000000000100",
  role: "operator" as const,
  permissions: ["task.read", "task.contact.read", "task.write"] as const,
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

  it("records actor, reason, timestamp, and retention for enabled transitions", async () => {
    const now = new Date("2026-07-16T04:00:00.000Z");
    const service = createInMemoryHumanTaskService({ now: () => now });
    const task = await service.create({
      identity: anonA,
      idempotencyKey: "00000000-0000-4000-8000-000000000110",
      request,
    });
    const triaged = await service.transition({
      taskId: task.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      toStatus: "triaged",
      reason: "Scope and data sufficiency were reviewed by the operator.",
    });
    expect(triaged.task).toMatchObject({ status: "triaged", updated_at: now.toISOString() });
    expect(triaged.transition).toMatchObject({
      actor_id: operator.userId,
      from_status: "requested",
      to_status: "triaged",
      reason: "Scope and data sufficiency were reviewed by the operator.",
    });

    const cancelled = await service.transition({
      taskId: task.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      toStatus: "cancelled",
      reason: "The traveler confirmed that assistance is no longer required.",
    });
    expect(cancelled.task.retention_expires_at).toBe("2026-10-14T04:00:00.000Z");
    await expect(
      service.listTransitions(task.id, { ...operator, permissions: [...operator.permissions] }),
    ).resolves.toHaveLength(2);
  });

  it("restricts task detail and persists an internal operator note", async () => {
    const now = new Date("2026-07-16T04:00:00.000Z");
    const service = createInMemoryHumanTaskService({ now: () => now });
    const task = await service.create({
      identity: anonA,
      idempotencyKey: "00000000-0000-4000-8000-000000000115",
      request,
    });

    await expect(
      service.getForOps(task.id, {
        userId: "00000000-0000-4000-8000-000000000200",
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      }),
    ).rejects.toBeInstanceOf(HumanTaskTransitionForbiddenError);

    const updated = await service.updateOperatorNote({
      taskId: task.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      note: "Traveler confirmed the hotel name and preferred reply channel.",
    });
    expect(updated.operator_note).toBe(
      "Traveler confirmed the hotel name and preferred reply channel.",
    );
    await expect(
      service.getForOps(task.id, { ...operator, permissions: [...operator.permissions] }),
    ).resolves.toEqual(updated);
  });

  it("stores only sanitized private evidence for a terminal task", async () => {
    let now = new Date("2026-07-20T02:00:00.000Z");
    const service = createInMemoryHumanTaskService({ now: () => now });
    const task = await service.create({
      identity: anonA,
      idempotencyKey: "00000000-0000-4000-8000-000000000116",
      request,
    });

    await expect(
      service.appendEvidence({
        taskId: task.id,
        actor: { ...operator, permissions: [...operator.permissions] },
        evidence: { kind: "outcome", content: "Called traveler@example.com before cancellation." },
      }),
    ).rejects.toBeInstanceOf(HumanTaskEvidencePolicyError);

    await service.transition({
      taskId: task.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      toStatus: "cancelled",
      reason: "The requested venue was outside the controlled preview scope.",
    });
    const evidence = await service.appendEvidence({
      taskId: task.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      evidence: {
        kind: "outcome",
        content: "Called traveler@example.com and confirmed +86 138 0013 8000 was not retained.",
      },
    });

    expect(evidence.content).not.toContain("traveler@example.com");
    expect(evidence.redaction_classes).toEqual(["email", "phone"]);
    await expect(
      service.listEvidence(task.id, { ...operator, permissions: [...operator.permissions] }),
    ).resolves.toEqual([evidence]);
    now = new Date("2026-10-19T02:00:00.000Z");
    await expect(
      service.listEvidence(task.id, { ...operator, permissions: [...operator.permissions] }),
    ).resolves.toEqual([]);
  });

  it("rejects unauthorized, illegal, and policy-gated transitions", async () => {
    const service = createInMemoryHumanTaskService();
    const task = await service.create({
      identity: anonA,
      idempotencyKey: "00000000-0000-4000-8000-000000000120",
      request,
    });

    await expect(
      service.transition({
        taskId: task.id,
        actor: {
          userId: "00000000-0000-4000-8000-000000000200",
          role: "editor",
          permissions: ["knowledge.read", "knowledge.write"],
        },
        toStatus: "triaged",
        reason: "Attempted by a role without Human Task write permission.",
      }),
    ).rejects.toBeInstanceOf(HumanTaskTransitionForbiddenError);
    await expect(
      service.transition({
        taskId: task.id,
        actor: { ...operator, permissions: [...operator.permissions] },
        toStatus: "done",
        reason: "Attempted to skip every required state in the lifecycle.",
      }),
    ).rejects.toMatchObject({ code: "INVALID_HUMAN_TASK_TRANSITION" });

    await service.transition({
      taskId: task.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      toStatus: "triaged",
      reason: "Scope and data sufficiency were reviewed by the operator.",
    });
    await expect(
      service.transition({
        taskId: task.id,
        actor: { ...operator, permissions: [...operator.permissions] },
        toStatus: "quoted",
        reason: "Attempted to quote before the payment route has been approved.",
      }),
    ).rejects.toBeInstanceOf(HumanTaskTransitionPolicyError);
  });
});
