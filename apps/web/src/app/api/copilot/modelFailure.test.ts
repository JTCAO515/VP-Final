import { describe, expect, it } from "vitest";
import { DemoModelExecutionError, DemoModelUnavailableError } from "@visepanda/app-server";
import { summarizeModelFailure } from "./modelFailure.js";

describe("summarizeModelFailure", () => {
  it("keeps only safe model-attempt metadata for execution failures", () => {
    const diagnostic = summarizeModelFailure(
      new DemoModelExecutionError([
        {
          provider: "concierge_primary",
          model: "kimi-k2.6",
          ok: false,
          latencyMs: 1_250,
          failureClass: "http_error",
        },
      ]),
    );

    expect(diagnostic).toEqual({
      code: "MODEL_REQUEST_FAILED",
      attempts: [
        {
          provider: "concierge_primary",
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
