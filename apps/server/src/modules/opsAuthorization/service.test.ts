import { describe, expect, it } from "vitest";
import {
  OpsForbiddenError,
  OpsUnauthorizedError,
  createInMemoryOpsAuthorizationService,
  requireOpsAccess,
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
      permissions: ["membership.read", "membership.write", "partner.read", "partner.write"],
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
    ] as const;
    for (const permission of permissions) {
      expect(matrix.editor.permissions.includes(permission)).toBe(
        permission.startsWith("knowledge."),
      );
      expect(matrix.operator.permissions.includes(permission)).toBe(permission.startsWith("task."));
      expect(matrix.admin.permissions.includes(permission)).toBe(
        permission.startsWith("membership.") || permission.startsWith("partner."),
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
});
