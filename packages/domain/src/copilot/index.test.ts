import { describe, expect, it } from "vitest";
import {
  CompletionJobSchema,
  CopilotEnvelopeSchema,
  GenerationProgressSchema,
  canTransitionCompletionJob,
} from "./index.js";

const message = {
  headline: "Plan updated",
  body: "I added a simple first day.",
};

const commercialAction = {
  id: "action-1",
  kind: "outbound_link",
  label: "Book this hotel",
  partner: "tripcom",
  disclosure: "Partner link",
  click_id: "click-1",
  url: "https://example.com/hotel",
};

describe("CopilotEnvelopeSchema", () => {
  it("parses a non-commercial envelope with defaults", () => {
    const parsed = CopilotEnvelopeSchema.parse({
      intent: "trip_edit",
      message,
    });

    expect(parsed.tripActions).toEqual([]);
    expect(parsed.commercialActions).toEqual([]);
    expect(parsed.risk.level).toBe("low");
  });

  it("rejects commercial actions outside commerce_intent", () => {
    expect(() =>
      CopilotEnvelopeSchema.parse({
        intent: "question",
        message,
        commercialActions: [commercialAction],
      }),
    ).toThrow("commercialActions require commerce_intent");
  });

  it("allows commercial actions for commerce_intent", () => {
    const parsed = CopilotEnvelopeSchema.parse({
      intent: "commerce_intent",
      message,
      commercialActions: [commercialAction],
    });

    expect(parsed.commercialActions[0]?.partner).toBe("tripcom");
  });
});

describe("GenerationProgressSchema", () => {
  it("defaults counters for visible two-pass progress", () => {
    const parsed = GenerationProgressSchema.parse({ status: "skeleton" });

    expect(parsed).toEqual({
      status: "skeleton",
      completedDays: 0,
      totalDays: 0,
      attempts: 0,
      error: null,
    });
  });
});

describe("CompletionJobSchema", () => {
  const job = {
    id: "59bf9155-8a71-442f-9c63-127a033f9564",
    tripId: "3e812700-ae6a-4eb9-ac60-189f847c33c2",
    baseVersion: 1,
    idempotencyKey: "d5527bc5-b918-44ba-bf2f-43f19337df1d",
    state: "queued",
    attempt: 0,
    maxAttempts: 2,
    errorCode: null,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
  };

  it("accepts the minimal durable completion state without a prompt or snapshot", () => {
    expect(CompletionJobSchema.parse(job)).toEqual(job);
  });

  it("keeps attempts bounded and rejects unrecognized lifecycle states", () => {
    expect(() => CompletionJobSchema.parse({ ...job, maxAttempts: 4 })).toThrow();
    expect(() => CompletionJobSchema.parse({ ...job, state: "retrying" })).toThrow();
  });

  it("allows only idempotent, terminal, and bounded retry transitions", () => {
    expect(canTransitionCompletionJob("queued", "running")).toBe(true);
    expect(canTransitionCompletionJob("running", "partial")).toBe(true);
    expect(canTransitionCompletionJob("failed", "queued")).toBe(true);
    expect(canTransitionCompletionJob("completed", "completed")).toBe(true);
    expect(canTransitionCompletionJob("completed", "queued")).toBe(false);
    expect(canTransitionCompletionJob("conflicted", "running")).toBe(false);
  });
});
