import {
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createInMemoryOpsAuthorizationService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import type { AuthorizedOpsRequest } from "../../../../../../../lib/opsAccess";
import { handleGapProposal } from "./handler";

const actor = {
  userId: "00000000-0000-4000-8000-000000000700",
  role: "operator" as const,
  permissions: ["task.read", "task.contact.read", "task.write"] as const,
};

async function fixture() {
  const taskService = createInMemoryHumanTaskService({
    now: () => new Date("2026-07-20T03:00:00.000Z"),
  });
  const task = await taskService.create({
    identity: { kind: "anonymous", anonId: "g".repeat(43) },
    idempotencyKey: crypto.randomUUID(),
    request: {
      city: "Shanghai",
      kind: "transport_help",
      description: "Please explain the accessible route to the railway station.",
      contact: "traveler@example.com",
    },
  });
  await taskService.transition({
    taskId: task.id,
    actor: { ...actor, permissions: [...actor.permissions] },
    toStatus: "cancelled",
    reason: "The traveler no longer required transport assistance.",
  });
  const evidence = await taskService.appendEvidence({
    taskId: task.id,
    actor: { ...actor, permissions: [...actor.permissions] },
    evidence: { kind: "outcome", content: "Official station accessibility details were unclear." },
  });
  const authorizationService = createInMemoryOpsAuthorizationService();
  const authorization: AuthorizedOpsRequest = {
    access: { ...actor, permissions: [...actor.permissions] },
    authorizationService,
    cookieResponse: NextResponse.next(),
  };
  return {
    task,
    evidence,
    knowledgeService: createInMemoryKnowledgeService([], []),
    authorizationService,
    dependencies: {
      authorize: async () => authorization,
      getTaskService: () => taskService,
      getKnowledgeService: () => createInMemoryKnowledgeService([], []),
    },
  };
}

describe("Human Task evidence gap proposal", () => {
  it("creates only a sanitized open gap from owned private evidence", async () => {
    const setup = await fixture();
    const response = await handleGapProposal(
      new Request("https://ops.example.com/gap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_pattern: "Can traveler@example.com find accessible station entrances?",
        }),
      }),
      { params: Promise.resolve({ taskId: setup.task.id, evidenceId: setup.evidence.id }) },
      { ...setup.dependencies, getKnowledgeService: () => setup.knowledgeService },
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.gap).toMatchObject({
      status: "open",
      city: "Shanghai",
      questionPattern: "can private email find accessible station entrances",
    });
    expect(payload.gap).not.toHaveProperty("factType");
  });

  it("does not create a gap for evidence outside the task", async () => {
    const setup = await fixture();
    const response = await handleGapProposal(
      new Request("https://ops.example.com/gap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question_pattern: "Which station entrances are accessible?" }),
      }),
      { params: Promise.resolve({ taskId: setup.task.id, evidenceId: crypto.randomUUID() }) },
      setup.dependencies,
    );
    expect(response.status).toBe(404);
  });
});
