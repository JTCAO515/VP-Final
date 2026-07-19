import {
  createInMemoryHumanTaskService,
  createInMemoryOpsAuthorizationService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import type { AuthorizedOpsRequest } from "../../../../lib/opsAccess";
import { handleTaskDetailGet, handleTaskNotePatch } from "./handler";

const operator = {
  userId: "00000000-0000-4000-8000-000000000100",
  role: "operator" as const,
  permissions: ["task.read", "task.contact.read", "task.write"] as const,
};

async function fixture() {
  const service = createInMemoryHumanTaskService({
    now: () => new Date("2026-07-20T06:00:00.000Z"),
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

describe("/api/tasks/:taskId", () => {
  it("returns minimum task detail, history, and preview-bounded actions", async () => {
    const { task, dependencies } = await fixture();
    const response = await handleTaskDetailGet(
      new Request(`https://ops.example.com/api/tasks/${task.id}`),
      { params: Promise.resolve({ taskId: task.id }) },
      dependencies,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task).toMatchObject({ id: task.id, contact: "traveler@example.com" });
    expect(payload.transitions).toEqual([]);
    expect(payload.allowed_transitions).toEqual(["triaged", "cancelled"]);
  });

  it("persists and clears an internal note without changing status", async () => {
    const { service, task, dependencies } = await fixture();
    const response = await handleTaskNotePatch(
      new Request(`https://ops.example.com/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operator_note: "Scope confirmed with the traveler." }),
      }),
      { params: Promise.resolve({ taskId: task.id }) },
      dependencies,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      note: "Scope confirmed with the traveler.",
    });
    expect(payload).not.toHaveProperty("task");
    expect(JSON.stringify(payload)).not.toContain("traveler@example.com");
    await expect(
      service.getForOps(task.id, { ...operator, permissions: [...operator.permissions] }),
    ).resolves.toMatchObject({ operator_note: "Scope confirmed with the traveler." });
  });

  it("returns authorization failures before reading task data", async () => {
    const { service, task } = await fixture();
    let serviceRequested = false;
    const response = await handleTaskDetailGet(
      new Request(`https://ops.example.com/api/tasks/${task.id}`),
      { params: Promise.resolve({ taskId: task.id }) },
      {
        authorize: async () =>
          NextResponse.json({ ok: false, error: "Ops authentication required." }, { status: 401 }),
        getService: () => {
          serviceRequested = true;
          return service;
        },
      },
    );

    expect(response.status).toBe(401);
    expect(serviceRequested).toBe(false);
  });

  it("returns forbidden before exposing task data to another Ops role", async () => {
    const { service, task } = await fixture();
    let serviceRequested = false;
    const response = await handleTaskDetailGet(
      new Request(`https://ops.example.com/api/tasks/${task.id}`),
      { params: Promise.resolve({ taskId: task.id }) },
      {
        authorize: async () =>
          NextResponse.json(
            { ok: false, error: "This account does not have permission for this Ops action." },
            { status: 403 },
          ),
        getService: () => {
          serviceRequested = true;
          return service;
        },
      },
    );

    expect(response.status).toBe(403);
    expect(serviceRequested).toBe(false);
  });

  it("returns not found and bad request without leaking another task", async () => {
    const missing = await fixture();
    const missingResponse = await handleTaskDetailGet(
      new Request("https://ops.example.com/api/tasks/missing"),
      { params: Promise.resolve({ taskId: "missing" }) },
      missing.dependencies,
    );
    expect(missingResponse.status).toBe(404);

    const malformed = await fixture();
    const malformedResponse = await handleTaskNotePatch(
      new Request(`https://ops.example.com/api/tasks/${malformed.task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
      { params: Promise.resolve({ taskId: malformed.task.id }) },
      malformed.dependencies,
    );
    expect(malformedResponse.status).toBe(400);
  });
});
