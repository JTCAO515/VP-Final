import { describe, expect, it, vi } from "vitest";
import { createInMemoryAgentTraceService } from "../trace/service.js";
import { createModelCompleteDay, parseGeneratedBlock } from "./completionDayModel.js";

describe("completion day model boundary", () => {
  it("repairs a fenced JSON object and assigns a deterministic block id", () => {
    expect(
      parseGeneratedBlock('```json\n{"type":"attraction","title":"Yu Garden",}\n```', "day-1"),
    ).toEqual({
      block: { id: "completion-day-1", type: "attraction", title: "Yu Garden" },
      repairCount: 1,
    });
  });

  it("records provider usage without storing prompt or output", async () => {
    const traceService = createInMemoryAgentTraceService();
    const generate = vi.fn(async () => ({
      content: '{"type":"restaurant","title":"Local lunch"}',
      attempts: [
        {
          provider: "planning_primary",
          model: "configured-model",
          ok: true,
          latencyMs: 10,
          inputTokens: 20,
          outputTokens: 10,
          costUsd: 0.001,
        },
      ],
    }));
    const complete = createModelCompleteDay({
      environment: {},
      traceService,
      runtime: { generate },
    });

    await expect(
      complete(
        { id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] },
        {
          jobId: "20000000-0000-0000-0000-000000000001",
          attempt: 1,
          tripId: "20000000-0000-0000-0000-000000000002",
          identity: { kind: "anonymous", anonId: "trace-owner" },
        },
      ),
    ).resolves.toMatchObject({ id: "completion-day-1", title: "Local lunch" });
    expect(traceService.listRuns()).toEqual([
      expect.objectContaining({
        status: "succeeded",
        attempts: [expect.objectContaining({ costUsd: 0.001 })],
      }),
    ]);
  });
});
