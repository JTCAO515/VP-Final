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
          route: "planning_primary",
          provider: "deepseek",
          model: "configured-model",
          ok: true,
          latencyMs: 10,
          inputTokens: 20,
          outputTokens: 10,
          costUsd: 0,
          costSnapshot: {
            provider: "deepseek",
            model: "configured-model",
            effort: "high" as const,
            inputTokens: 20,
            cachedInputTokens: 0,
            outputTokens: 10,
            inputPricePerMillionUsd: "0",
            cachedInputPricePerMillionUsd: "0",
            outputPricePerMillionUsd: "0",
            costUsd: "0.00000000",
            pricingMissing: true,
            fallbackTriggered: false,
          },
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
        attempts: [
          expect.objectContaining({
            provider: "deepseek",
            costUsd: 0,
            costSnapshot: expect.objectContaining({ pricingMissing: true }),
          }),
        ],
      }),
    ]);
  });
});
