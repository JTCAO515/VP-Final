import { describe, expect, it } from "vitest";
import {
  OpsForbiddenError,
  OpsUnauthorizedError,
  createInMemoryOpsAuthorizationService,
  requireOpsAccess,
  resolveOpsAuditFilters,
  sanitizeAuditMetadata,
} from "./service.js";

const editorId = "11111111-1111-4111-8111-111111111111";
const operatorId = "22222222-2222-4222-8222-222222222222";
const adminId = "33333333-3333-4333-8333-333333333333";

describe("Ops authorization", () => {
  it("distinguishes unauthenticated from authenticated but forbidden access", async () => {
    const service = createInMemoryOpsAuthorizationService([{ userId: editorId, role: "editor" }]);
    const editor = await service.getAccess(editorId);

    expect(() => requireOpsAccess({ kind: "none" }, null, "knowledge.read")).toThrow(
      OpsUnauthorizedError,
    );
    expect(() =>
      requireOpsAccess({ kind: "authenticated", userId: editorId }, editor, "task.read"),
    ).toThrow(OpsForbiddenError);
  });

  it("uses an explicit least-privilege matrix for every role", async () => {
    const service = createInMemoryOpsAuthorizationService([
      { userId: editorId, role: "editor" },
      { userId: operatorId, role: "operator" },
      { userId: adminId, role: "admin" },
    ]);

    await expect(service.getAccess(editorId)).resolves.toMatchObject({
      permissions: ["knowledge.read", "knowledge.write"],
    });
    await expect(service.getAccess(operatorId)).resolves.toMatchObject({
      permissions: ["task.read", "task.contact.read", "task.write"],
    });
    await expect(service.getAccess(adminId)).resolves.toMatchObject({
      permissions: [
        "membership.read",
        "membership.write",
        "partner.read",
        "partner.write",
        "cost.read",
        "visepod.provision",
      ],
    });

    const matrix = {
      editor: (await service.getAccess(editorId))!,
      operator: (await service.getAccess(operatorId))!,
      admin: (await service.getAccess(adminId))!,
    };
    const permissions = [
      "knowledge.read",
      "knowledge.write",
      "task.read",
      "task.contact.read",
      "task.write",
      "membership.read",
      "membership.write",
      "partner.read",
      "partner.write",
      "cost.read",
      "visepod.provision",
    ] as const;
    for (const permission of permissions) {
      expect(matrix.editor.permissions.includes(permission)).toBe(
        permission.startsWith("knowledge."),
      );
      expect(matrix.operator.permissions.includes(permission)).toBe(permission.startsWith("task."));
      expect(matrix.admin.permissions.includes(permission)).toBe(
        permission.startsWith("membership.") ||
          permission.startsWith("partner.") ||
          permission.startsWith("cost.") ||
          permission === "visepod.provision",
      );
    }
  });

  it("lets only an admin change membership and records actor/timestamp evidence", async () => {
    const service = createInMemoryOpsAuthorizationService([
      { userId: editorId, role: "editor" },
      { userId: adminId, role: "admin" },
    ]);
    const editor = (await service.getAccess(editorId))!;
    const admin = (await service.getAccess(adminId))!;

    await expect(service.setMembership(editor, operatorId, "operator")).rejects.toThrow(
      OpsForbiddenError,
    );
    await expect(service.setMembership(admin, adminId, "editor")).rejects.toThrow(
      OpsForbiddenError,
    );
    await expect(service.setMembership(admin, operatorId, "operator")).resolves.toMatchObject({
      userId: operatorId,
      role: "operator",
      createdBy: adminId,
    });
    await expect(service.listAudit(admin)).resolves.toMatchObject([
      {
        actorId: adminId,
        action: "membership.set",
        targetId: operatorId,
      },
    ]);
  });

  it("revokes a different member immediately while preserving the membership audit trail", async () => {
    const service = createInMemoryOpsAuthorizationService([
      { userId: adminId, role: "admin" },
      { userId: operatorId, role: "operator" },
    ]);
    const admin = (await service.getAccess(adminId))!;

    await expect(service.revokeMembership(admin, operatorId)).resolves.toMatchObject({
      userId: operatorId,
      revokedBy: adminId,
    });
    await expect(service.getAccess(operatorId)).resolves.toBeNull();
    await expect(service.listMemberships(admin)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: operatorId, revokedBy: adminId })]),
    );
    await expect(service.listAudit(admin)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: adminId,
          action: "membership.revoked",
          targetId: operatorId,
        }),
      ]),
    );
  });

  it("refuses self-management and removal or demotion of the final active admin", async () => {
    const service = createInMemoryOpsAuthorizationService([{ userId: adminId, role: "admin" }]);
    const admin = (await service.getAccess(adminId))!;

    await expect(service.setMembership(admin, adminId, "admin")).rejects.toThrow(OpsForbiddenError);
    await expect(service.revokeMembership(admin, adminId)).rejects.toThrow(OpsForbiddenError);

    const secondAdminId = "44444444-4444-4444-8444-444444444444";
    await service.setMembership(admin, secondAdminId, "admin");
    await expect(service.revokeMembership(admin, secondAdminId)).resolves.toMatchObject({
      userId: secondAdminId,
      revokedBy: adminId,
    });
    await expect(service.setMembership(admin, secondAdminId, "editor")).resolves.toMatchObject({
      role: "editor",
    });
  });

  it("returns only bounded, sanitized audit events for an exact actor/action/time filter", async () => {
    const service = createInMemoryOpsAuthorizationService([{ userId: adminId, role: "admin" }]);
    const admin = (await service.getAccess(adminId))!;
    await service.recordAudit(admin, {
      action: "membership.set",
      targetType: "ops_membership",
      metadata: { role: "editor", token: "must-not-render", nested: { unsafe: true } },
    });
    await service.recordAudit(admin, { action: "partner.updated", targetType: "partner" });

    await expect(
      service.listAudit(admin, { actorId: adminId, action: "membership.set" }),
    ).resolves.toEqual([
      expect.objectContaining({ action: "membership.set", metadata: { role: "editor" } }),
    ]);
    expect(() =>
      resolveOpsAuditFilters({
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).toThrow("no longer than 90 days");
    expect(sanitizeAuditMetadata({ cookie: "x", status: "active", nested: { value: 1 } })).toEqual({
      status: "active",
    });
  });
});
