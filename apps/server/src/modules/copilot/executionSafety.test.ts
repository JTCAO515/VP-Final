import { type CopilotEnvelope } from "@visepanda/domain";
import { describe, expect, it } from "vitest";
import {
  ExecutionFactSupportError,
  classifyHighRiskRequest,
  resolveHighRiskEnvelope,
  validateExecutionFactSupport,
  type ExecutionFactSupport,
} from "./executionSafety.js";

const supportedFact: ExecutionFactSupport = {
  id: "fact-verified",
  supportingValues: ["Metro Line 10", "09:30", "CNY 40", "123 Example Road"],
};

const baseEnvelope: CopilotEnvelope = {
  intent: "question" as const,
  message: {
    headline: "Verified answer",
    body: "",
    highlights: [],
  },
  tripActions: [],
  toolCards: [],
  commercialActions: [],
  humanHelp: null,
  risk: { level: "low", reason: null },
  citations: [{ fact_id: "fact-verified" }],
};

describe("classifyHighRiskRequest", () => {
  it("uses closed, safety-first category matching", () => {
    expect(classifyHighRiskRequest("I have a severe peanut allergy")).toBe("allergy_dietary");
    expect(classifyHighRiskRequest("I need a doctor for this symptom")).toBe("symptoms_medical");
    expect(classifyHighRiskRequest("Call an ambulance in an emergency")).toBe("emergency_help");
    expect(classifyHighRiskRequest("Show my passport statement")).toBe("passport_visa_ticket");
    expect(classifyHighRiskRequest("My boarding ticket needs a Chinese statement")).toBe(
      "passport_visa_ticket",
    );
    expect(classifyHighRiskRequest("What is the taxi address?")).toBe("destination_address");
  });
});

describe("validateExecutionFactSupport", () => {
  it.each([
    ["address", "Meet at 999 Invented Road."],
    ["route", "Take Metro Line 99."],
    ["time", "Arrive at 18:45."],
    ["price", "The fare is CNY 999."],
  ])("rejects an unsupported %s", (_, body) => {
    expect(() =>
      validateExecutionFactSupport({
        ...baseEnvelope,
        message: { ...baseEnvelope.message, body },
      }),
    ).toThrow(ExecutionFactSupportError);
  });

  it("permits a concrete fact only when its cited fact contains the exact value", () => {
    expect(() =>
      validateExecutionFactSupport(
        {
          ...baseEnvelope,
          message: { ...baseEnvelope.message, body: "The verified fare is CNY 40." },
        },
        [supportedFact],
      ),
    ).not.toThrow();
  });

  it("does not accept a retrieved but uncited supporting value", () => {
    expect(() =>
      validateExecutionFactSupport(
        {
          ...baseEnvelope,
          citations: [],
          message: { ...baseEnvelope.message, body: "The verified fare is CNY 40." },
        },
        [supportedFact],
      ),
    ).toThrow(ExecutionFactSupportError);
  });
});

describe("resolveHighRiskEnvelope", () => {
  const selection = {
    category: "allergy_dietary" as const,
    scene: "restaurant" as const,
    intentKey: "peanut-allergy",
    variantKey: "plain",
    severity: "severe" as const,
  };
  const phrase = {
    id: "8ad64607-dc57-4d5b-8dfb-3d2813aac985",
    ...selection,
    chineseExpression: "我对花生严重过敏。",
    englishIntent: "I have a severe peanut allergy.",
    sourceClass: "operator_verified" as const,
    sourceLocator: "ops://safe-phrase/peanut-allergy",
    evidenceSummary: "Reviewed by a qualified operator.",
    verifiedBy: "a75ea05d-0146-4ba5-ae21-7374c623967a",
    verifiedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    reviewPolicy: "operator-verified-90d-v1" as const,
    status: "reviewed" as const,
    createdAt: "2026-08-10T00:00:00.000Z",
  };

  it("returns only the exact eligible fixed expression", async () => {
    await expect(
      resolveHighRiskEnvelope({
        category: "allergy_dietary",
        intent: "question",
        selection,
        resolveSafePhrase: async (requested) =>
          requested.intentKey === selection.intentKey ? phrase : null,
        now: new Date("2026-08-11T00:00:00.000Z"),
        includeHumanHelp: true,
      }),
    ).resolves.toMatchObject({
      message: { body: "我对花生严重过敏。" },
      humanHelp: null,
    });
  });

  it("returns the frozen unavailable response and a controlled handoff when no phrase exists", async () => {
    await expect(
      resolveHighRiskEnvelope({
        category: "allergy_dietary",
        intent: "question",
        selection,
        resolveSafePhrase: async () => null,
        now: new Date("2026-08-11T00:00:00.000Z"),
        includeHumanHelp: true,
      }),
    ).resolves.toMatchObject({
      message: {
        body: "I can’t safely create a card for this allergy or dietary restriction. Please use a verified card or ask the venue to confirm ingredients before consuming.",
      },
      humanHelp: { kind: "task" },
    });
  });

  it("never substitutes a standard phrase for a severe selection", async () => {
    await expect(
      resolveHighRiskEnvelope({
        category: "allergy_dietary",
        intent: "question",
        selection,
        resolveSafePhrase: async () => ({ ...phrase, severity: "standard" }),
        now: new Date("2026-08-11T00:00:00.000Z"),
        includeHumanHelp: true,
      }),
    ).resolves.toMatchObject({
      humanHelp: { kind: "task" },
    });
  });
});
