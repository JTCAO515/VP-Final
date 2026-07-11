import { describe, expect, it } from "vitest";
import { requireService } from "./requireService.js";

describe("requireService", () => {
  it("returns an explicitly injected service", () => {
    const service = { name: "memory-test" };
    expect(requireService(service, "Knowledge")).toBe(service);
  });

  it("fails closed with a typed, secret-free unavailable error", () => {
    expect(() => requireService(undefined, "Knowledge")).toThrowError(
      expect.objectContaining({
        code: "SERVICE_UNAVAILABLE",
        message: "Knowledge is unavailable.",
      }),
    );
  });
});
