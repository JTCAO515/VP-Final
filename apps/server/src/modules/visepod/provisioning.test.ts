import { describe, expect, it } from "vitest";
import { createInMemoryOpsAuthorizationService } from "../opsAuthorization/service.js";
import {
  createInMemoryVisePodProvisioningService,
  digestVisePodProvisioningToken,
  VisePodProvisioningAccessDeniedError,
} from "./provisioning.js";

const adminId = "33700000-0000-4000-8000-000000000001";
const editorId = "33700000-0000-4000-8000-000000000002";
const secondAdminId = "33700000-0000-4000-8000-000000000003";

describe("VisePod Studio provisioning grants", () => {
  it("issues an opaque single-scope grant only to the explicit admin permission", async () => {
    const authorization = createInMemoryOpsAuthorizationService([
      { userId: adminId, role: "admin" },
      { userId: editorId, role: "editor" },
    ]);
    const service = createInMemoryVisePodProvisioningService(
      authorization,
      () => new Date("2026-08-13T00:00:00.000Z"),
    );
    const admin = (await authorization.getAccess(adminId))!;
    const editor = (await authorization.getAccess(editorId))!;
    const issued = await service.issue(admin, "development");

    expect(issued).toMatchObject({ scope: "visepod.provision", environment: "development" });
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(digestVisePodProvisioningToken(issued.token)).toMatch(/^[a-f0-9]{64}$/);
    await expect(service.issue(editor, "development")).rejects.toBeInstanceOf(
      VisePodProvisioningAccessDeniedError,
    );
  });

  it("rejects cross-environment, revoked, expired, and permission-revoked grants", async () => {
    let at = new Date("2026-08-13T00:00:00.000Z");
    const authorization = createInMemoryOpsAuthorizationService([
      { userId: adminId, role: "admin" },
      { userId: secondAdminId, role: "admin" },
    ]);
    const service = createInMemoryVisePodProvisioningService(authorization, () => at);
    const admin = (await authorization.getAccess(adminId))!;
    const issued = await service.issue(admin, "development");

    expect(await service.validate(issued.token, "production")).toBeNull();
    expect(await service.validate(issued.token, "development")).toMatchObject({
      access: { userId: adminId, permissions: expect.arrayContaining(["visepod.provision"]) },
    });

    const current = await service.validate(issued.token, "development");
    await service.revoke(admin, current!.grant.tokenId);
    expect(await service.validate(issued.token, "development")).toBeNull();

    const expiry = await service.issue(admin, "development");
    at = new Date("2026-08-13T08:00:00.000Z");
    expect(await service.validate(expiry.token, "development")).toBeNull();

    at = new Date("2026-08-13T00:00:00.000Z");
    const permissionRemoval = await service.issue(admin, "development");
    await authorization.setMembership(
      (await authorization.getAccess(secondAdminId))!,
      adminId,
      "editor",
    );
    expect(await service.validate(permissionRemoval.token, "development")).toBeNull();
  });
});
