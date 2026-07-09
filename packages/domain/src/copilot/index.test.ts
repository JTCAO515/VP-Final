import { describe, expect, it } from "vitest";
import { CopilotEnvelopeSchema } from "./index.js";

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
