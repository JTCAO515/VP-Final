import { describe, expect, it } from "vitest";

import {
  CHINA_READINESS_QUESTIONS,
  ChinaReadinessAssessmentSchema,
  deriveChinaReadinessResult,
} from "./index.js";

describe("China Readiness Check domain contract", () => {
  it("defines ten deterministic preparation questions without a percentage score", () => {
    expect(CHINA_READINESS_QUESTIONS).toHaveLength(10);
    expect(new Set(CHINA_READINESS_QUESTIONS.map((question) => question.id)).size).toBe(10);
    expect(JSON.stringify(CHINA_READINESS_QUESTIONS)).not.toMatch(/score|percent|%/i);
  });

  it("derives every rule deterministically with explicit self-reported evidence", () => {
    const result = deriveChinaReadinessResult({
      version: 1,
      answers: CHINA_READINESS_QUESTIONS.map((question, index) => ({
        questionId: question.id,
        value: index % 2 === 0 ? "confirmed" : "not_confirmed",
      })),
      persistenceConsent: "declined",
    });

    expect(result.persistenceConsent).toBe("declined");
    expect(result.items).toHaveLength(10);
    for (const [index, item] of result.items.entries()) {
      expect(item.ruleId).toBe(`china-readiness-v1:${item.questionId}`);
      expect(item.evidenceStatus).toBe("self_reported");
      expect(item.status).toBe(index % 2 === 0 ? "ready" : "action_required");
    }
  });

  it("keeps missing answers explicitly unknown instead of assuming success or failure", () => {
    const result = deriveChinaReadinessResult({ version: 1, answers: [] });

    expect(result.items).toHaveLength(10);
    expect(result.items.every((item) => item.observedAnswer === "unknown")).toBe(true);
    expect(result.items.every((item) => item.status === "unknown")).toBe(true);
    expect(result.items.every((item) => item.evidenceStatus === "not_provided")).toBe(true);
  });

  it("rejects duplicate answers rather than allowing last-answer-wins behavior", () => {
    expect(
      ChinaReadinessAssessmentSchema.safeParse({
        version: 1,
        answers: [
          { questionId: "payment_method", value: "confirmed" },
          { questionId: "payment_method", value: "not_confirmed" },
        ],
      }).success,
    ).toBe(false);
  });
});
