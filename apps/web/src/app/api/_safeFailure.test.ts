import { describe, expect, it, vi } from "vitest";
import { reportSafeRouteFailure } from "./_safeFailure.js";

describe("reportSafeRouteFailure", () => {
  it("logs only a generated correlation id and normalized route metadata", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const correlationId = reportSafeRouteFailure(
      {
        route: "/api/copilot",
        capability: "copilot",
        failureClass: "unexpected_error",
      },
      () => "4e63db44-0ac0-4751-a045-e9c9fe96dc85",
    );

    expect(correlationId).toBe("4e63db44-0ac0-4751-a045-e9c9fe96dc85");
    expect(errorLog).toHaveBeenCalledWith("web_route_failure", {
      correlationId,
      route: "/api/copilot",
      capability: "copilot",
      failureClass: "unexpected_error",
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("prompt");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("cookie");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("signature");
  });
});
