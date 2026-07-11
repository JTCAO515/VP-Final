import { z } from "zod";
import type { RequestIdentity } from "../../context.js";

export const OpsRoleSchema = z.enum(["operator", "editor", "admin"]);
export type OpsRole = z.infer<typeof OpsRoleSchema>;

export const OpsPermissionSchema = z.enum([
  "knowledge.read",
  "knowledge.write",
  "task.read",
  "task.contact.read",
  "task.write",
  "membership.read",
  "membership.write",
  "partner.read",
  "partner.write",
]);
export type OpsPermission = z.infer<typeof OpsPermissionSchema>;

export type OpsAccess = {
  userId: string;
  role: OpsRole;
  permissions: OpsPermission[];
};

export type OpsMembership = {
  userId: string;
  role: OpsRole;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpsAuditEvent = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RecordOpsAuditInput = {
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export type OpsAuthorizationService = {
  getAccess(userId: string): Promise<OpsAccess | null>;
  listMemberships(actor: OpsAccess): Promise<OpsMembership[]>;
  setMembership(actor: OpsAccess, userId: string, role: OpsRole): Promise<OpsMembership>;
  recordAudit(actor: OpsAccess, input: RecordOpsAuditInput): Promise<OpsAuditEvent>;
  listAudit(actor: OpsAccess): Promise<OpsAuditEvent[]>;
};

const ROLE_PERMISSIONS: Record<OpsRole, readonly OpsPermission[]> = {
  editor: ["knowledge.read", "knowledge.write"],
  operator: ["task.read", "task.contact.read", "task.write"],
  admin: ["membership.read", "membership.write", "partner.read", "partner.write"],
};

export function permissionsForRole(role: OpsRole): OpsPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function requireOpsAccess(
  identity: RequestIdentity | undefined,
  access: OpsAccess | null,
  permission: OpsPermission,
): OpsAccess {
  if (identity?.kind !== "authenticated") throw new OpsUnauthorizedError();
  if (!access || access.userId !== identity.userId || !access.permissions.includes(permission)) {
    throw new OpsForbiddenError();
  }
  return access;
}

export class OpsUnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Ops authentication required.");
    this.name = "OpsUnauthorizedError";
  }
}

export class OpsForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("This account does not have permission for this Ops action.");
    this.name = "OpsForbiddenError";
  }
}

export function createInMemoryOpsAuthorizationService(
  seed: Array<{ userId: string; role: OpsRole }> = [],
): OpsAuthorizationService {
  const now = new Date().toISOString();
  const memberships = new Map<string, OpsMembership>(
    seed.map(({ userId, role }) => [
      userId,
      { userId, role, createdBy: null, createdAt: now, updatedAt: now },
    ]),
  );
  const audit: OpsAuditEvent[] = [];

  return {
    async getAccess(userId) {
      const membership = memberships.get(userId);
      return membership
        ? { userId, role: membership.role, permissions: permissionsForRole(membership.role) }
        : null;
    },
    async listMemberships(actor) {
      assertPermission(actor, "membership.read");
      return [...memberships.values()].map((membership) => ({ ...membership }));
    },
    async setMembership(actor, userId, role) {
      assertPermission(actor, "membership.write");
      if (userId === actor.userId && role !== actor.role) {
        throw new OpsForbiddenError();
      }
      const timestamp = new Date().toISOString();
      const existing = memberships.get(userId);
      const membership: OpsMembership = {
        userId,
        role: OpsRoleSchema.parse(role),
        createdBy: existing?.createdBy ?? actor.userId,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      memberships.set(userId, membership);
      await this.recordAudit(actor, {
        action: "membership.set",
        targetType: "ops_membership",
        targetId: userId,
        metadata: { role },
      });
      return { ...membership };
    },
    async recordAudit(actor, input) {
      const event: OpsAuditEvent = {
        id: crypto.randomUUID(),
        actorId: actor.userId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: structuredClone(input.metadata ?? {}),
        createdAt: new Date().toISOString(),
      };
      audit.push(event);
      return { ...event };
    },
    async listAudit(actor) {
      assertPermission(actor, "membership.read");
      return audit.map((event) => ({ ...event, metadata: structuredClone(event.metadata) }));
    },
  };
}

function assertPermission(access: OpsAccess, permission: OpsPermission): void {
  if (!access.permissions.includes(permission)) throw new OpsForbiddenError();
}
