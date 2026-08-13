import { and, eq, isNull } from "drizzle-orm";
import {
  VISEPOD_STUDIO_PROVISION_SCOPE,
  VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS,
  VisePodStudioEnvironmentSchema,
  type VisePodStudioEnvironment,
  type VisePodStudioProvisioningGrant,
  type VisePodStudioProvisioningTokenIssueResponse,
} from "@visepanda/domain";
import type { Db } from "./client.js";
import { opsAuditEvents, visePodProvisioningGrants } from "./schema.js";
import type { OpsAccess, OpsAuthorizationService } from "../modules/opsAuthorization/service.js";
import {
  createVisePodProvisioningToken,
  digestVisePodProvisioningToken,
  requireVisePodProvisioningAccess,
  type VisePodProvisioningService,
} from "../modules/visepod/provisioning.js";

export function createDbVisePodProvisioningService(
  db: Db,
  authorizationService: OpsAuthorizationService,
  now: () => Date = () => new Date(),
): VisePodProvisioningService {
  return {
    async issue(actor, environment) {
      requireVisePodProvisioningAccess(actor);
      const issuedAt = now();
      const token = createVisePodProvisioningToken();
      const expiresAt = new Date(
        issuedAt.getTime() + VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS * 1000,
      );
      const [grant] = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(visePodProvisioningGrants)
          .values({
            tokenDigest: digestVisePodProvisioningToken(token),
            opsUserId: actor.userId,
            scope: VISEPOD_STUDIO_PROVISION_SCOPE,
            environment: VisePodStudioEnvironmentSchema.parse(environment),
            issuedAt,
            expiresAt,
          })
          .returning();
        const row = rows[0];
        if (!row) throw new Error("VisePod provisioning grant insert failed.");
        await tx.insert(opsAuditEvents).values({
          actorId: actor.userId,
          action: "visepod.provision.token_issued",
          targetType: "visepod_provisioning_grant",
          targetId: row.id,
          metadataJsonb: { environment: row.environment, result: "succeeded" },
        });
        return [row] as const;
      });
      return {
        token,
        scope: VISEPOD_STUDIO_PROVISION_SCOPE,
        environment: VisePodStudioEnvironmentSchema.parse(grant.environment),
        expiresAt: grant.expiresAt.toISOString(),
      } satisfies VisePodStudioProvisioningTokenIssueResponse;
    },
    async validate(token, environment) {
      const parsedEnvironment = VisePodStudioEnvironmentSchema.parse(environment);
      const [row] = await db
        .select()
        .from(visePodProvisioningGrants)
        .where(
          and(
            eq(visePodProvisioningGrants.tokenDigest, digestVisePodProvisioningToken(token)),
            eq(visePodProvisioningGrants.environment, parsedEnvironment),
            isNull(visePodProvisioningGrants.revokedAt),
          ),
        )
        .limit(1);
      if (!row || row.expiresAt.getTime() <= now().getTime()) return null;
      const access = await authorizationService.getAccess(row.opsUserId);
      if (!access || !access.permissions.includes("visepod.provision")) return null;
      return { grant: grantFromRow(row), access };
    },
    async revoke(actor, grantId) {
      requireVisePodProvisioningAccess(actor);
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(visePodProvisioningGrants)
          .set({ revokedAt: now(), revokedBy: actor.userId })
          .where(
            and(
              eq(visePodProvisioningGrants.id, grantId),
              isNull(visePodProvisioningGrants.revokedAt),
            ),
          )
          .returning();
        const row = rows[0];
        if (!row) throw new Error("VisePod provisioning grant is unavailable.");
        await tx.insert(opsAuditEvents).values({
          actorId: actor.userId,
          action: "visepod.provision.token_revoked",
          targetType: "visepod_provisioning_grant",
          targetId: row.id,
          metadataJsonb: { environment: row.environment, result: "succeeded" },
        });
      });
    },
  };
}

function grantFromRow(
  row: typeof visePodProvisioningGrants.$inferSelect,
): VisePodStudioProvisioningGrant {
  return {
    tokenId: row.id,
    opsUserId: row.opsUserId,
    scope: VISEPOD_STUDIO_PROVISION_SCOPE,
    environment: VisePodStudioEnvironmentSchema.parse(row.environment),
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}
