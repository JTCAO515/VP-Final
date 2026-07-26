import { describe, expect, it } from "vitest";
import { getOpsCostSummaryService } from "./opsCostSummary";

describe("getOpsCostSummaryService", () => {
  it("never invents a memory-backed cost summary", () => {
    expect(() => getOpsCostSummaryService({ VISEPANDA_RUNTIME_MODE: "local-demo" })).toThrow(
      "Durable Copilot cost summary is unavailable in this runtime.",
    );
    expect(() => getOpsCostSummaryService({ VISEPANDA_RUNTIME_MODE: "test" })).toThrow(
      "Durable Copilot cost summary is unavailable in this runtime.",
    );
  });

  it("fails honestly when the deployed database adapter is missing", () => {
    expect(() => getOpsCostSummaryService({ VISEPANDA_RUNTIME_MODE: "preview" })).toThrow(
      "Durable Copilot cost summary is unavailable.",
    );
  });
});
