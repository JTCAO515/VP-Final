import { eq } from "drizzle-orm";
import {
  VisePodStudioExactUserLookupRequestSchema,
  VisePodUserLookupAuditMetadataSchema,
  type VisePodStudioExactUserLookupRequest,
  type VisePodStudioEnvironment,
  type VisePodStudioResolvedUser,
} from "@visepanda/domain";
import type { Db } from "./client.js";
import { opsAuditEvents, users } from "./schema.js";
import type { VisePodProvisioningService } from "../modules/visepod/provisioning.js";
import type { VisePodStudioUserLookupRateLimiter } from "../modules/visepod/userLookupLimiter.js";
import {
  VisePodUserLookupNotFoundError,
  asVisePodResolvedUser,
  digestVisePodUserLookupIdentifier,
  exactUserLookupIdentifier,
  requireVisePodUserLookupAccess,
  type VisePodUserResolutionService,
} from "../modules/visepod/userResolution.js";

/**
 * The sole durable exact-user resolver for VisePod Studio. Grant validation and rate
 * admission happen before the transaction, then the exact read and privacy-safe audit
 * commit together. It intentionally has no list, cursor, similarity, or prefix query.
 */
export function createDbVisePodUserResolutionService(
  db: Db,
  provisioningService: VisePodProvisioningService,
  rateLimiter: VisePodStudioUserLookupRateLimiter,
  now: () => Date = () => new Date(),
): VisePodUserResolutionService {
  return {
    async resolve(input) {
      const actor = await requireVisePodUserLookupAccess({
        provisioningService,
        rateLimiter,
        token: input.token,
        environment: input.environment,
      });
      const request = VisePodStudioExactUserLookupRequestSchema.parse(input.request);
      const identifier = exactUserLookupIdentifier(request);
      const identifierDigest = digestVisePodUserLookupIdentifier(request);

      const resolved = await db.transaction(async (tx) => {
        const [row] =
          identifier.kind === "email"
            ? await tx
                .select({ id: users.id, email: users.email })
                .from(users)
                .where(eq(users.email, identifier.value))
                .limit(1)
            : await tx
                .select({ id: users.id, email: users.email })
                .from(users)
                .where(eq(users.id, identifier.value))
                .limit(1);

        await tx.insert(opsAuditEvents).values({
          actorId: actor.userId,
          action: "visepod.user.resolve",
          targetType: "visepod_user_lookup",
          targetId: identifierDigest,
          metadataJsonb: VisePodUserLookupAuditMetadataSchema.parse({
            identifierKind: identifier.kind,
            identifierDigest,
            result: row ? "found" : "not_found",
          }),
          createdAt: now(),
        });
        return row ? asVisePodResolvedUser({ userId: row.id, email: row.email }) : null;
      });
      if (!resolved) throw new VisePodUserLookupNotFoundError();
      return resolved;
    },
  };
}

export type {
  VisePodStudioExactUserLookupRequest,
  VisePodStudioEnvironment,
  VisePodStudioResolvedUser,
};
