import { describe, expect, it } from "vitest";
import {
  isDailyLlmBudgetExceeded,
  normalizeUsd,
  prepareDailyBudgetExceededEvent,
  resolveDailyLlmBudgetUsd,
  utcBudgetDay,
} from "./dailyBudget.js";

describe("daily Copilot budget observation", () => {
  it("keeps alerting disabled when unset and validates a positive fixed-point threshold", () => {
    expect(resolveDailyLlmBudgetUsd({})).toBeNull();
    expect(resolveDailyLlmBudgetUsd({ VISEPANDA_DAILY_LLM_BUDGET_USD: "1.25" })).toBe("1.25000000");
    expect(() => resolveDailyLlmBudgetUsd({ VISEPANDA_DAILY_LLM_BUDGET_USD: "0" })).toThrow(
      "must be a positive fixed-point USD amount",
    );
    expect(() =>
      resolveDailyLlmBudgetUsd({ VISEPANDA_DAILY_LLM_BUDGET_USD: "1.000000001" }),
    ).toThrow("at most 8 decimals");
  });

  it("compares fixed-point USD without floating-point arithmetic", () => {
    expect(normalizeUsd("0.1")).toBe("0.10000000");
    expect(isDailyLlmBudgetExceeded("1.00000000", "1.00000000")).toBe(false);
    expect(isDailyLlmBudgetExceeded("1.00000001", "1.00000000")).toBe(true);
  });

  it("builds a retained, identity-bound event keyed only by its UTC day", () => {
    const createdAt = new Date("2026-07-25T23:59:59.000Z");
    expect(utcBudgetDay(createdAt)).toEqual({
      day: "2026-07-25",
      start: new Date("2026-07-25T00:00:00.000Z"),
      end: new Date("2026-07-26T00:00:00.000Z"),
    });

    const event = prepareDailyBudgetExceededEvent({
      identity: { kind: "anonymous", anonId: "signed-anon-budget" },
      budgetUsd: "1.00",
      observedCostUsd: "1.25",
      createdAt,
      retentionDays: 180,
    });

    expect(event).toMatchObject({
      action: "daily_budget_exceeded",
      entity_type: "llm_daily_budget",
      entity_id: "2026-07-25",
      props_jsonb: {
        budgetUsd: "1.00000000",
        observedCostUsd: "1.25000000",
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/api[_-]?key|cookie|signature|prompt/i);
  });
});
