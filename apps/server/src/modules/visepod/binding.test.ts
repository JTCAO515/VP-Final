import { describe, expect, it } from "vitest";
import { createInMemoryOpsAuthorizationService } from "../opsAuthorization/service.js";
import { createInMemoryVisePodProvisioningService } from "./provisioning.js";
import {
  createVisePodKnownDeviceCatalog,
  digestVisePodBindingCommand,
  requireVisePodBindingProvisioningAccess,
  resolveVisePodKnownDeviceCatalog,
  VisePodBindingProvisioningAccessDeniedError,
} from "./binding.js";

const adminId = "33900000-0000-4000-8000-000000000001";

describe("VisePod Studio binding boundary", () => {
  it("accepts only an explicit finite catalog and hashes the complete canonical command", () => {
    const catalog = createVisePodKnownDeviceCatalog(["device-001"]);
    expect(catalog.has("device-001")).toBe(true);
    expect(catalog.has("device-002")).toBe(false);
    expect(() => resolveVisePodKnownDeviceCatalog("device-001,,device-002")).toThrow();
    expect(() => resolveVisePodKnownDeviceCatalog("device-001,device-001")).toThrow();
    expect(
      digestVisePodBindingCommand({
        operation: "bind",
        deviceId: "device-001",
        userId: "33900000-0000-4000-8000-000000000002",
        idempotencyKey: "33900000-0000-4000-8000-000000000003",
        reason: "Assign the controlled demonstration device to the selected traveler.",
      }),
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("validates the provisioning grant before a later service can inspect device data", async () => {
    const authorization = createInMemoryOpsAuthorizationService([
      { userId: adminId, role: "admin" },
    ]);
    const provisioning = createInMemoryVisePodProvisioningService(authorization);
    await expect(
      requireVisePodBindingProvisioningAccess({
        provisioningService: provisioning,
        token: "not-a-valid-provisioning-token",
        environment: "development",
      }),
    ).rejects.toBeInstanceOf(VisePodBindingProvisioningAccessDeniedError);
  });
});
