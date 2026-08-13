import { and, eq, isNull, sql } from "drizzle-orm";
import {
  VISEPOD_STUDIO_IDEMPOTENCY_RETENTION_DAYS,
  VisePodBindingAuditMetadataSchema,
  VisePodBindingCommandSchema,
  VisePodBindingMutationResponseSchema,
  VisePodDeviceBindingSchema,
  VisePodDeviceIdSchema,
  type VisePodBindingCommand,
  type VisePodDeviceBinding,
} from "@visepanda/domain";
import type { Db } from "./client.js";
import {
  opsAuditEvents,
  users,
  visePodBindingIdempotency,
  visePodDeviceBindings,
} from "./schema.js";
import type { VisePodProvisioningService } from "../modules/visepod/provisioning.js";
import {
  asVisePodBindingMutationResponse,
  createVisePodKnownDeviceCatalog,
  digestVisePodBindingCommand,
  requireVisePodBindingProvisioningAccess,
  type VisePodBindingService,
  type VisePodKnownDeviceCatalog,
  VisePodBindingDeviceNotFoundError,
  VisePodBindingIdempotencyConflictError,
  VisePodBindingStateConflictError,
  VisePodBindingUserNotFoundError,
} from "../modules/visepod/binding.js";

type PersistenceHooks = {
  beforeAudit?: () => Promise<void> | void;
};

/**
 * The only durable writer for private Studio device assignments. It validates the
 * short-lived grant before touching binding, idempotency, or user records, then keeps
 * mutation, replay receipt, and audit evidence inside one transaction.
 */
export function createDbVisePodBindingService(
  db: Db,
  provisioningService: VisePodProvisioningService,
  knownDevices: VisePodKnownDeviceCatalog = createVisePodKnownDeviceCatalog([]),
  now: () => Date = () => new Date(),
  hooks: PersistenceHooks = {},
): VisePodBindingService {
  return {
    async get(input) {
      await requireVisePodBindingProvisioningAccess({
        provisioningService,
        token: input.token,
        environment: input.environment,
      });
      const deviceId = VisePodDeviceIdSchema.parse(input.deviceId);
      if (!knownDevices.has(deviceId)) throw new VisePodBindingDeviceNotFoundError();
      const [row] = await db
        .select()
        .from(visePodDeviceBindings)
        .where(
          and(
            eq(visePodDeviceBindings.deviceId, deviceId),
            eq(visePodDeviceBindings.state, "active"),
          ),
        )
        .limit(1);
      return row ? bindingFromRow(row) : null;
    },

    async mutate(input) {
      const actor = await requireVisePodBindingProvisioningAccess({
        provisioningService,
        token: input.token,
        environment: input.environment,
      });
      const command = VisePodBindingCommandSchema.parse(input.command);
      if (!knownDevices.has(command.deviceId)) throw new VisePodBindingDeviceNotFoundError();
      const commandDigest = digestVisePodBindingCommand(command);

      return db.transaction(async (tx) => {
        // Lock key first and device second in every write path. This makes replay/conflict and
        // concurrent device rebinds deterministic without introducing a second idempotency store.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`visepod-idempotency:${command.idempotencyKey}`}, 0))`,
        );
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`visepod-device:${command.deviceId}`}, 0))`,
        );

        const [existingReplay] = await tx
          .select()
          .from(visePodBindingIdempotency)
          .where(eq(visePodBindingIdempotency.idempotencyKey, command.idempotencyKey))
          .limit(1);
        if (existingReplay) {
          if (existingReplay.commandDigest !== commandDigest) {
            throw new VisePodBindingIdempotencyConflictError();
          }
          const original = VisePodBindingMutationResponseSchema.parse(existingReplay.responseJsonb);
          return asVisePodBindingMutationResponse({ ...original, idempotencyHit: true });
        }

        if (command.operation === "bind") {
          const [user] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, command.userId))
            .limit(1);
          if (!user) throw new VisePodBindingUserNotFoundError();
        }

        const [currentRow] = await tx
          .select()
          .from(visePodDeviceBindings)
          .where(
            and(
              eq(visePodDeviceBindings.deviceId, command.deviceId),
              eq(visePodDeviceBindings.state, "active"),
            ),
          )
          .limit(1);
        const currentBinding = currentRow ? bindingFromRow(currentRow) : null;

        if (command.operation === "unbind" && !currentBinding) {
          throw new VisePodBindingStateConflictError();
        }
        if (command.operation === "bind" && currentBinding?.userId === command.userId) {
          throw new VisePodBindingStateConflictError();
        }

        const at = now();
        const transition =
          command.operation === "bind"
            ? {
                outcome: currentBinding ? ("rebound" as const) : ("created" as const),
                binding: {
                  deviceId: command.deviceId,
                  userId: command.userId,
                  state: "active" as const,
                  boundAt: at.toISOString(),
                  boundBy: actor.userId,
                },
              }
            : { outcome: "revoked" as const, binding: null };

        let persistedBindingId: string;
        if (currentRow) {
          const [revoked] = await tx
            .update(visePodDeviceBindings)
            .set({ state: "revoked", revokedAt: at, revokedBy: actor.userId })
            .where(eq(visePodDeviceBindings.id, currentRow.id))
            .returning();
          if (!revoked) throw new Error("VisePod binding revoke did not persist.");
          persistedBindingId = revoked.id;
        } else {
          persistedBindingId = "";
        }

        if (transition.binding) {
          const [created] = await tx
            .insert(visePodDeviceBindings)
            .values({
              deviceId: transition.binding.deviceId,
              userId: transition.binding.userId,
              state: "active",
              boundAt: at,
              boundBy: actor.userId,
            })
            .returning();
          if (!created) throw new Error("VisePod binding insert failed.");
          persistedBindingId = created.id;
        }

        const response = asVisePodBindingMutationResponse({
          outcome: transition.outcome,
          idempotencyHit: false,
          binding: transition.binding,
        });
        await tx.insert(visePodBindingIdempotency).values({
          idempotencyKey: command.idempotencyKey,
          bindingId: persistedBindingId,
          commandDigest,
          responseJsonb: response,
          retentionExpiresAt: new Date(
            at.getTime() + VISEPOD_STUDIO_IDEMPOTENCY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
          ),
          createdAt: at,
        });

        await hooks.beforeAudit?.();
        const action = `visepod.binding.${transition.outcome}` as const;
        await tx.insert(opsAuditEvents).values({
          actorId: actor.userId,
          action,
          targetType: "visepod_device_binding",
          targetId: command.deviceId,
          metadataJsonb: VisePodBindingAuditMetadataSchema.parse({
            deviceId: command.deviceId,
            previousUserId: currentBinding?.userId ?? null,
            nextUserId: transition.binding?.userId ?? null,
            result: "succeeded",
          }),
        });
        return response;
      });
    },
  };
}

function bindingFromRow(row: typeof visePodDeviceBindings.$inferSelect): VisePodDeviceBinding {
  return VisePodDeviceBindingSchema.parse({
    deviceId: row.deviceId,
    userId: row.userId,
    state: row.state,
    boundAt: row.boundAt.toISOString(),
    boundBy: row.boundBy,
  });
}
