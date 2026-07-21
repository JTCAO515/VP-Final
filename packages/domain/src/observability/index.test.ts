import { describe, expect, it } from "vitest";
import {
  containsForbiddenConversationMaterial,
  CopilotConversationTurnSchema,
  CopilotProductEventActionSchema,
  CopilotProductEventSchema,
  LlmCallCostRecordSchema,
} from "./index.js";

const createdAt = "2026-07-19T10:00:00.000Z";
const expiresAt = "2026-08-18T10:00:00.000Z";

describe("Copilot persistence contracts", () => {
  it("accepts a redacted successful conversation turn", () => {
    const parsed = CopilotConversationTurnSchema.parse({
      id: "0d4db9c5-8f90-41c3-8cdf-f86368d0d521",
      session_id: "d8818bc4-dd98-4632-b0c4-aaf49f08420e",
      agent_run_id: "10f9aa82-9d48-4cd7-bfbb-cb846c5dbfad",
      identity: { anon_id: "anonymous-session" },
      status: "succeeded",
      user_message: "Plan two metro-friendly days in Shanghai.",
      assistant_envelope: {
        intent: "question",
        message: { headline: "Shanghai by metro", body: "Start near People's Square." },
      },
      city_intent: "Shanghai",
      created_at: createdAt,
      retention_expires_at: expiresAt,
    });

    expect(parsed.assistant_envelope?.message.highlights).toEqual([]);
    expect(parsed.redaction_classes).toEqual([]);
  });

  it("rejects PII, credentials, cookies, signatures, and invalid retention", () => {
    expect(
      containsForbiddenConversationMaterial({
        nested: { cookie: "signed-value", provider: `sk-${"abcdefghijklmnop"}` },
      }),
    ).toBe(true);
    expect(() =>
      CopilotConversationTurnSchema.parse({
        id: "0d4db9c5-8f90-41c3-8cdf-f86368d0d521",
        session_id: "d8818bc4-dd98-4632-b0c4-aaf49f08420e",
        identity: { anon_id: "anonymous-session" },
        status: "failed",
        user_message: "Email me at traveler@example.com",
        failure_class: "provider_error",
        created_at: createdAt,
        retention_expires_at: createdAt,
      }),
    ).toThrow();
  });

  it("requires reconcilable cost and the frozen Copilot event actions", () => {
    const parsed = LlmCallCostRecordSchema.parse({
      id: "de59183c-a42e-4a0d-b8b7-d63cd9fbc378",
      agent_run_id: "10f9aa82-9d48-4cd7-bfbb-cb846c5dbfad",
      identity: { user_id: "d879df9f-79b5-43bb-9987-a6040f6ae983" },
      attempt_index: 1,
      provider: "moonshot",
      model: "configured-model-id",
      effort: "medium",
      status: "succeeded",
      input_tokens: 120,
      cached_input_tokens: 20,
      output_tokens: 80,
      input_price_per_million_usd: 0.2,
      cached_input_price_per_million_usd: 0.04,
      output_price_per_million_usd: 0.8,
      cost_usd: 0.0000848,
      fallback_triggered: false,
      latency_ms: 820,
      created_at: createdAt,
      retention_expires_at: expiresAt,
    });

    expect(parsed.attempt_index).toBe(1);
    expect(parsed.cached_input_tokens).toBe(20);
    expect(CopilotProductEventActionSchema.options).toEqual([
      "session_started",
      "turn_completed",
      "anon_limit_hit",
      "rate_limited",
      "register_prompt_shown",
      "fallback_triggered",
      "model_failure",
      "cost_pricing_missing",
    ]);
    expect(() =>
      CopilotProductEventSchema.parse({
        id: "event-1",
        anon_id: "anonymous-session",
        surface: "server",
        action: "turn_completed",
        entity_type: "copilot_turn",
        created_at: createdAt,
      }),
    ).toThrow();
    expect(() =>
      LlmCallCostRecordSchema.parse({
        ...parsed,
        cached_input_tokens: parsed.input_tokens + 1,
      }),
    ).toThrow();
    expect(() =>
      CopilotProductEventSchema.parse({
        id: "event-1",
        anon_id: "anonymous-session",
        surface: "server",
        action: "model_failure",
        entity_type: "copilot_turn",
        props_jsonb: { signature: "raw-signature-value" },
        created_at: createdAt,
        retention_expires_at: expiresAt,
      }),
    ).toThrow();
    expect(() =>
      CopilotProductEventSchema.parse({
        id: "event-1",
        anon_id: "anonymous-session",
        surface: "server",
        action: "turn_completed",
        entity_type: "copilot_turn",
        created_at: createdAt,
        retention_expires_at: "2026-07-18T10:00:00.000Z",
      }),
    ).toThrow();
    expect(() =>
      CopilotConversationTurnSchema.parse({
        id: "0d4db9c5-8f90-41c3-8cdf-f86368d0d521",
        session_id: "d8818bc4-dd98-4632-b0c4-aaf49f08420e",
        identity: { anon_id: "anonymous-session" },
        status: "failed",
        user_message: "My passport number is E12345678",
        failure_class: "provider_error",
        created_at: createdAt,
        retention_expires_at: expiresAt,
      }),
    ).toThrow();
  });
});
