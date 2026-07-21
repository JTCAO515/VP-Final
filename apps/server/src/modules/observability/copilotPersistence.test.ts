import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONVERSATION_RETENTION_DAYS,
  DEFAULT_COST_RETENTION_DAYS,
  DEFAULT_EVENT_RETENTION_DAYS,
  opaqueCopilotSessionId,
  prepareCopilotConversationTurn,
  redactCopilotConversation,
  resolveCopilotRetentionPolicy,
} from "./copilotPersistence.js";

const envelope = {
  intent: "chat_only" as const,
  message: {
    headline: "Private details",
    body: "Email alex@example.com and Authorization=Bearer-secret-value.",
    highlights: ["Passport E12345678"],
  },
  tripActions: [],
  toolCards: [],
  commercialActions: [],
  humanHelp: null,
  citations: [],
  risk: { level: "low" as const, reason: null },
};

describe("Copilot persistence preparation", () => {
  it("uses frozen retention defaults and accepts positive env overrides", () => {
    expect(resolveCopilotRetentionPolicy({})).toEqual({
      conversationDays: DEFAULT_CONVERSATION_RETENTION_DAYS,
      costDays: DEFAULT_COST_RETENTION_DAYS,
      eventDays: DEFAULT_EVENT_RETENTION_DAYS,
    });
    expect(
      resolveCopilotRetentionPolicy({
        VISEPANDA_CONV_RETENTION_DAYS: "181",
        VISEPANDA_COST_RETENTION_DAYS: "401",
        VISEPANDA_EVENT_RETENTION_DAYS: "182",
      }),
    ).toEqual({ conversationDays: 181, costDays: 401, eventDays: 182 });
    expect(() => resolveCopilotRetentionPolicy({ VISEPANDA_CONV_RETENTION_DAYS: "0" })).toThrow(
      "VISEPANDA_CONV_RETENTION_DAYS must be a positive integer",
    );
  });

  it("derives stable opaque sessions only from the trusted identity", () => {
    const first = opaqueCopilotSessionId({ kind: "anonymous", anonId: "signed-anon-a" });
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(opaqueCopilotSessionId({ kind: "anonymous", anonId: "signed-anon-a" })).toBe(first);
    expect(opaqueCopilotSessionId({ kind: "anonymous", anonId: "signed-anon-b" })).not.toBe(first);
    expect(
      opaqueCopilotSessionId({
        kind: "authenticated",
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    ).not.toBe(first);
  });

  it("redacts restricted material recursively before domain validation", () => {
    const redacted = redactCopilotConversation(
      "Call +1 415 555 0123; cookie=session-secret; signature=abc123def456; sk-secretvalue12345",
      envelope,
    );
    const serialized = JSON.stringify(redacted);

    expect(redacted.redactionClasses).toEqual([
      "cookie",
      "credential",
      "email",
      "phone",
      "travel_document",
    ]);
    expect(serialized).not.toContain("415 555 0123");
    expect(serialized).not.toContain("session-secret");
    expect(serialized).not.toContain("abc123def456");
    expect(serialized).not.toContain("sk-secretvalue12345");
    expect(serialized).not.toContain("alex@example.com");
    expect(serialized).not.toContain("E12345678");
  });

  it("prepares a schema-valid turn with an exact retention deadline", () => {
    const createdAt = new Date("2026-07-21T00:00:00.000Z");
    const turn = prepareCopilotConversationTurn({
      id: "22222222-2222-4222-8222-222222222222",
      agentRunId: "33333333-3333-4333-8333-333333333333",
      identity: { kind: "anonymous", anonId: "signed-anon-a" },
      status: "succeeded",
      userMessage: "Hello",
      assistantEnvelope: envelope,
      createdAt,
      retentionDays: 180,
    });

    expect(turn.created_at).toBe(createdAt.toISOString());
    expect(Date.parse(turn.retention_expires_at) - createdAt.getTime()).toBe(
      180 * 24 * 60 * 60 * 1_000,
    );
  });
});
