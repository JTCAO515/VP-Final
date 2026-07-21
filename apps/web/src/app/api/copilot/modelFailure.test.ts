import { describe, expect, it } from "vitest";
import { DemoModelExecutionError, DemoModelUnavailableError } from "@visepanda/app-server";
import { summarizeModelFailure } from "./modelFailure.js";

describe("summarizeModelFailure", () => {
  it("keeps only safe model-attempt metadata for execution failures", () => {
    const diagnostic = summarizeModelFailure(
      new DemoModelExecutionError([
        {
          route: "concierge_primary",
          provider: "moonshot",
          model: "kimi-k2.6",
          ok: false,
          latencyMs: 1_250,
          failureClass: "http_error",
          costSnapshot: {
            provider: "moonshot",
            model: "kimi-k2.6",
            effort: "medium",
            inputTokens: 0,
            cachedInputTokens: 0,
            outputTokens: 0,
            inputPricePerMillionUsd: "0.95000000",
            cachedInputPricePerMillionUsd: "0.16000000",
            outputPricePerMillionUsd: "4.00000000",
            costUsd: "0.00000000",
            pricingMissing: false,
            fallbackTriggered: false,
          },
        },
      ]),
    );

    expect(diagnostic).toEqual({
      code: "MODEL_REQUEST_FAILED",
      attempts: [
        {
          provider: "moonshot",
          model: "kimi-k2.6",
          failureClass: "http_error",
          latencyMs: 1_250,
        },
      ],
    });
  });

  it("does not invent attempts for an incomplete configuration", () => {
    expect(summarizeModelFailure(new DemoModelUnavailableError(["router_primary"]))).toEqual({
      code: "MODEL_CONFIGURATION_UNAVAILABLE",
      attempts: [],
    });
  });
});
