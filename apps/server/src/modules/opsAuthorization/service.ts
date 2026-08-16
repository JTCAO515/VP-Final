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
  "cost.read",
  "visepod.provision",
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
  revokedAt: string | null;
  revokedBy: string | null;
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

export const OpsAuditFilterSchema = z.object({
  action: z.string().trim().min(1).max(120).optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  to: z.coerce.date().optional(),
});
export type OpsAuditFilters = z.input<typeof OpsAuditFilterSchema>;
export type ResolvedOpsAuditFilters = z.output<typeof OpsAuditFilterSchema> & {
  from: Date;
  to: Date;
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
  setMembershipByExactEmail(
    actor: OpsAccess,
    email: string,
    role: OpsRole,
  ): Promise<OpsMembership | null>;
  revokeMembership(actor: OpsAccess, userId: string): Promise<OpsMembership | null>;
  recordAudit(actor: OpsAccess, input: RecordOpsAuditInput): Promise<OpsAuditEvent>;
  listAudit(actor: OpsAccess, filters?: OpsAuditFilters): Promise<OpsAuditEvent[]>;
};

const ROLE_PERMISSIONS: Record<OpsRole, readonly OpsPermission[]> = {
  editor: ["knowledge.read", "knowledge.write"],
  operator: ["task.read", "task.contact.read", "task.write"],
  admin: [
    "membership.read",
    "membership.write",
    "partner.read",
    "partner.write",
    "cost.read",
    "visepod.provision",
  ],
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
      {
        userId,
        role,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        revokedAt: null,
        revokedBy: null,
      },
    ]),
  );
  const audit: OpsAuditEvent[] = [];

  return {
    async getAccess(userId) {
      const membership = memberships.get(userId);
      return membership && !membership.revokedAt
        ? { userId, role: membership.role, permissions: permissionsForRole(membership.role) }
        : null;
    },
    async listMemberships(actor) {
      assertPermission(actor, "membership.read");
      return [...memberships.values()].map((membership) => ({ ...membership }));
    },
    async setMembership(actor, userId, role) {
      assertPermission(actor, "membership.write");
      if (userId === actor.userId) {
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
        revokedAt: null,
        revokedBy: null,
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
    async setMembershipByExactEmail() {
      throw new Error(
        "Exact email resolution is unavailable in the in-memory authorization service.",
      );
    },
    async revokeMembership(actor, userId) {
      assertPermission(actor, "membership.write");
      if (userId === actor.userId) throw new OpsForbiddenError();
      const existing = memberships.get(userId);
      if (!existing || existing.revokedAt) return null;
      if (existing.role === "admin" && activeAdminCount(memberships) <= 1) {
        throw new OpsForbiddenError();
      }
      const timestamp = new Date().toISOString();
      const membership: OpsMembership = {
        ...existing,
        revokedAt: timestamp,
        revokedBy: actor.userId,
        updatedAt: timestamp,
      };
      memberships.set(userId, membership);
      await this.recordAudit(actor, {
        action: "membership.revoked",
        targetType: "ops_membership",
        targetId: userId,
        metadata: { role: existing.role },
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
    async listAudit(actor, filters) {
      assertPermission(actor, "membership.read");
      const resolved = resolveOpsAuditFilters(filters);
      return audit
        .filter((event) => matchesAuditFilters(event, resolved))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, resolved.limit)
        .map((event) => ({ ...event, metadata: sanitizeAuditMetadata(event.metadata) }));
    },
  };
}

function activeAdminCount(memberships: ReadonlyMap<string, OpsMembership>): number {
  return [...memberships.values()].filter(
    (membership) => membership.role === "admin" && !membership.revokedAt,
  ).length;
}

function assertPermission(access: OpsAccess, permission: OpsPermission): void {
  if (!access.permissions.includes(permission)) throw new OpsForbiddenError();
}

const DEFAULT_AUDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AUDIT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const sensitiveAuditKey =
  /password|token|cookie|signature|secret|email|contact|phone|address|note|description/i;

export function resolveOpsAuditFilters(
  filters: OpsAuditFilters | undefined,
  now = new Date(),
): ResolvedOpsAuditFilters {
  const parsed = OpsAuditFilterSchema.parse(filters ?? {});
  const to = parsed.to ?? now;
  const from = parsed.from ?? new Date(to.getTime() - DEFAULT_AUDIT_WINDOW_MS);
  if (from > to || to.getTime() - from.getTime() > MAX_AUDIT_WINDOW_MS) {
    throw new Error("Audit time range must be ordered and no longer than 90 days.");
  }
  return { ...parsed, from, to };
}

export function sanitizeAuditMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(value)
    .filter(([key]) => key.length <= 64 && !sensitiveAuditKey.test(key))
    .slice(0, 12)
    .flatMap(([key, entry]) => {
      const sanitized = sanitizeAuditValue(entry);
      return sanitized === undefined ? [] : [[key, sanitized] as const];
    });
  return Object.fromEntries(entries);
}

function sanitizeAuditValue(value: unknown): boolean | number | string | null | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return value.length <= 160 ? value : undefined;
  return undefined;
}

function matchesAuditFilters(event: OpsAuditEvent, filters: ResolvedOpsAuditFilters): boolean {
  const createdAt = new Date(event.createdAt);
  return (
    createdAt >= filters.from &&
    createdAt <= filters.to &&
    (!filters.actorId || event.actorId === filters.actorId) &&
    (!filters.action || event.action === filters.action)
  );
}
