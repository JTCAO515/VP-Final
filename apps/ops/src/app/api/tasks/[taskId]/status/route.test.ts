import {
  createInMemoryHumanTaskService,
  createInMemoryOpsAuthorizationService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import type { AuthorizedOpsRequest } from "../../../../../lib/opsAccess";
import { handleTaskStatusPatch } from "./handler";

const operator = {
  userId: "00000000-0000-4000-8000-000000000100",
  role: "operator" as const,
  permissions: ["task.read", "task.contact.read", "task.write"] as const,
};

async function fixture() {
  const service = createInMemoryHumanTaskService({
    now: () => new Date("2026-07-16T06:00:00.000Z"),
  });
  const task = await service.create({
    identity: { kind: "anonymous", anonId: "a".repeat(43) },
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    request: {
      city: "Shanghai",
      kind: "translation_help",
      description: "Please translate this request for the hotel reception team.",
      contact: "traveler@example.com",
    },
  });
  const authorization: AuthorizedOpsRequest = {
    access: { ...operator, permissions: [...operator.permissions] },
    authorizationService: createInMemoryOpsAuthorizationService(),
    cookieResponse: NextResponse.next(),
  };
  return {
    service,
    task,
    dependencies: {
      authorize: async () => authorization,
      getService: () => service,
    },
  };
}

function request(body: unknown) {
  return new Request("https://ops.example.com/api/tasks/task-id/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/tasks/:taskId/status", () => {
  it("uses the authorized actor and returns persisted transition evidence", async () => {
    const { task, dependencies } = await fixture();
    const response = await handleTaskStatusPatch(
      request({
        to_status: "triaged",
        reason: "Scope and data sufficiency were reviewed by the operator.",
        actor_id: "00000000-0000-4000-8000-000000000999",
      }),
      { params: Promise.resolve({ taskId: task.id }) },
      dependencies,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task.status).toBe("triaged");
    expect(payload.transition.actor_id).toBe(operator.userId);
  });

  it("maps invalid and preview-blocked transitions to conflict", async () => {
    const invalid = await fixture();
    const invalidResponse = await handleTaskStatusPatch(
      request({
        to_status: "done",
        reason: "Attempted to skip the required lifecycle states entirely.",
      }),
      { params: Promise.resolve({ taskId: invalid.task.id }) },
      invalid.dependencies,
    );
    expect(invalidResponse.status).toBe(409);

    const gated = await fixture();
    await gated.service.transition({
      taskId: gated.task.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      toStatus: "triaged",
      reason: "Scope and data sufficiency were reviewed by the operator.",
    });
    const gatedResponse = await handleTaskStatusPatch(
      request({
        to_status: "quoted",
        reason: "Attempted before the approved payment path is available.",
      }),
      { params: Promise.resolve({ taskId: gated.task.id }) },
      gated.dependencies,
    );
    expect(gatedResponse.status).toBe(409);
  });

  it("returns authorization failures before reading request state", async () => {
    const { service, task } = await fixture();
    const response = await handleTaskStatusPatch(
      request({ to_status: "triaged", reason: "This body must not be applied." }),
      { params: Promise.resolve({ taskId: task.id }) },
      {
        authorize: async () =>
          NextResponse.json({ ok: false, error: "Ops authentication required." }, { status: 401 }),
        getService: () => service,
      },
    );
    expect(response.status).toBe(401);
    await expect(service.listForOps()).resolves.toEqual([
      expect.objectContaining({ status: "requested" }),
    ]);
  });

  it("returns bad request for malformed JSON", async () => {
    const { task, dependencies } = await fixture();
    const response = await handleTaskStatusPatch(
      new Request("https://ops.example.com/api/tasks/task-id/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
      { params: Promise.resolve({ taskId: task.id }) },
      dependencies,
    );
    expect(response.status).toBe(400);
  });
});
