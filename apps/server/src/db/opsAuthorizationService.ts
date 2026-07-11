import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { opsAuditEvents, opsMemberships } from "./schema.js";
import {
  OpsRoleSchema,
  permissionsForRole,
  type OpsAccess,
  type OpsAuditEvent,
  type OpsAuthorizationService,
  type OpsMembership,
  type RecordOpsAuditInput,
} from "../modules/opsAuthorization/service.js";

export function createDbOpsAuthorizationService(db: Db): OpsAuthorizationService {
  async function recordAudit(actor: OpsAccess, input: RecordOpsAuditInput): Promise<OpsAuditEvent> {
    const [row] = await db
      .insert(opsAuditEvents)
      .values({
        actorId: actor.userId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadataJsonb: input.metadata ?? {},
      })
      .returning();
    if (!row) throw new Error("Ops audit insert failed.");
    return auditFromRow(row);
  }

  return {
    async getAccess(userId) {
      const [row] = await db
        .select()
        .from(opsMemberships)
        .where(eq(opsMemberships.userId, userId))
        .limit(1);
      if (!row) return null;
      const role = OpsRoleSchema.parse(row.role);
      return { userId, role, permissions: permissionsForRole(role) };
    },
    async listMemberships(actor) {
      requirePermission(actor, "membership.read");
      return (await db.select().from(opsMemberships)).map(membershipFromRow);
    },
    async setMembership(actor, userId, role) {
      requirePermission(actor, "membership.write");
      const parsedRole = OpsRoleSchema.parse(role);
      if (userId === actor.userId && parsedRole !== actor.role) {
        throw new Error("An admin cannot change their own role.");
      }
      const row = await db.transaction(async (transaction) => {
        const [membership] = await transaction
          .insert(opsMemberships)
          .values({ userId, role: parsedRole, createdBy: actor.userId })
          .onConflictDoUpdate({
            target: opsMemberships.userId,
            set: { role: parsedRole, updatedAt: new Date() },
          })
          .returning();
        if (!membership) throw new Error("Ops membership write failed.");
        await transaction.insert(opsAuditEvents).values({
          actorId: actor.userId,
          action: "membership.set",
          targetType: "ops_membership",
          targetId: userId,
          metadataJsonb: { role: parsedRole },
        });
        return membership;
      });
      return membershipFromRow(row);
    },
    recordAudit,
    async listAudit(actor) {
      requirePermission(actor, "membership.read");
      return (await db.select().from(opsAuditEvents)).map(auditFromRow);
    },
  };
}

function requirePermission(access: OpsAccess, permission: OpsAccess["permissions"][number]): void {
  if (!access.permissions.includes(permission)) {
    throw new Error("Forbidden Ops permission.");
  }
}

function membershipFromRow(row: typeof opsMemberships.$inferSelect): OpsMembership {
  return {
    userId: row.userId,
    role: OpsRoleSchema.parse(row.role),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function auditFromRow(row: typeof opsAuditEvents.$inferSelect): OpsAuditEvent {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata:
      typeof row.metadataJsonb === "object" && row.metadataJsonb !== null
        ? (row.metadataJsonb as Record<string, unknown>)
        : {},
    createdAt: row.createdAt.toISOString(),
  };
}
