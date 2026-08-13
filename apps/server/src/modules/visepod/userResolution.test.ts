import { describe, expect, it } from "vitest";
import { createInMemoryOpsAuthorizationService } from "../opsAuthorization/service.js";
import { createInMemoryVisePodProvisioningService } from "./provisioning.js";
import { createInMemoryVisePodStudioUserLookupRateLimiter } from "./userLookupLimiter.js";
import {
  VisePodUserLookupRateLimitedError,
  asVisePodResolvedUser,
  digestVisePodUserLookupIdentifier,
  exactUserLookupIdentifier,
  maskVisePodUserLookupEmail,
  requireVisePodUserLookupAccess,
} from "./userResolution.js";

const adminId = "34000000-0000-4000-8000-000000000001";

describe("VisePod exact user resolution boundary", () => {
  it("requires a provisioning grant before it admits an exact lookup", async () => {
    const authorization = createInMemoryOpsAuthorizationService([
      { userId: adminId, role: "admin" },
    ]);
    const provisioning = createInMemoryVisePodProvisioningService(authorization);
    let checks = 0;
    const limiter = {
      check: async () => {
        checks += 1;
        return { allowed: true as const, minuteRemaining: 5, hourRemaining: 29 };
      },
    };

    await expect(
      requireVisePodUserLookupAccess({
        provisioningService: provisioning,
        rateLimiter: limiter,
        token: "not-a-valid-provisioning-token",
        environment: "development",
      }),
    ).rejects.toThrow("provisioning access");
    expect(checks).toBe(0);
  });

  it("has no partial-match helper and produces only a masked response/audit digest", () => {
    const input = { email: "traveler@example.test" };
    expect(exactUserLookupIdentifier(input)).toEqual({ kind: "email", value: input.email });
    expect(digestVisePodUserLookupIdentifier(input)).toMatch(/^[a-f0-9]{64}$/);
    expect(digestVisePodUserLookupIdentifier(input)).not.toContain(input.email);
    expect(maskVisePodUserLookupEmail(input.email)).toBe("t***@example.test");
    expect(
      asVisePodResolvedUser({
        userId: "34000000-0000-4000-8000-000000000002",
        email: input.email,
      }),
    ).toEqual({
      userId: "34000000-0000-4000-8000-000000000002",
      displayName: null,
      emailHint: "t***@example.test",
    });
  });

  it("returns a bounded retry value instead of admitting enumeration", async () => {
    const authorization = createInMemoryOpsAuthorizationService([
      { userId: adminId, role: "admin" },
    ]);
    const provisioning = createInMemoryVisePodProvisioningService(authorization);
    const token = (
      await provisioning.issue((await authorization.getAccess(adminId))!, "development")
    ).token;
    const limiter = createInMemoryVisePodStudioUserLookupRateLimiter({ minuteLimit: 1 });
    await expect(
      requireVisePodUserLookupAccess({
        provisioningService: provisioning,
        rateLimiter: limiter,
        token,
        environment: "development",
      }),
    ).resolves.toMatchObject({ userId: adminId });
    await expect(
      requireVisePodUserLookupAccess({
        provisioningService: provisioning,
        rateLimiter: limiter,
        token,
        environment: "development",
      }),
    ).rejects.toBeInstanceOf(VisePodUserLookupRateLimitedError);
  });
});
