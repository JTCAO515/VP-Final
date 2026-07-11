import { describe, expect, it } from "vitest";
import { pendingOpsCapabilityResponse } from "./runtimeAvailability";

describe("pendingOpsCapabilityResponse", () => {
  it("quarantines deployed tasks and permits explicit tests", async () => {
    const unavailable = pendingOpsCapabilityResponse("Human Tasks", {
      VISEPANDA_RUNTIME_MODE: "production",
    });
    expect(unavailable?.status).toBe(503);
    await expect(unavailable?.json()).resolves.toMatchObject({
      code: "CAPABILITY_UNAVAILABLE",
    });
    expect(
      pendingOpsCapabilityResponse("Human Tasks", { VISEPANDA_RUNTIME_MODE: "test" }),
    ).toBeNull();
  });
});
