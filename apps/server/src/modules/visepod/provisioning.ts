import { createHash, randomBytes } from "node:crypto";
import {
  VISEPOD_STUDIO_PROVISION_SCOPE,
  VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS,
  VisePodStudioEnvironmentSchema,
  type VisePodStudioEnvironment,
  type VisePodStudioProvisioningGrant,
  type VisePodStudioProvisioningTokenIssueResponse,
} from "@visepanda/domain";
import type { OpsAccess, OpsAuthorizationService } from "../opsAuthorization/service.js";

export type VisePodProvisioningGrantRecord = VisePodStudioProvisioningGrant & {
  tokenDigest: string;
};

export type VisePodProvisioningService = {
  issue(
    actor: OpsAccess,
    environment: VisePodStudioEnvironment,
  ): Promise<VisePodStudioProvisioningTokenIssueResponse>;
  validate(
    token: string,
    environment: VisePodStudioEnvironment,
  ): Promise<{ grant: VisePodStudioProvisioningGrant; access: OpsAccess } | null>;
  revoke(actor: OpsAccess, grantId: string): Promise<void>;
};

export class VisePodProvisioningAccessDeniedError extends Error {
  constructor() {
    super("VisePod Studio provisioning access is unavailable.");
    this.name = "VisePodProvisioningAccessDeniedError";
  }
}

export function digestVisePodProvisioningToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createVisePodProvisioningToken(): string {
  return randomBytes(32).toString("base64url");
}

export function requireVisePodProvisioningAccess(access: OpsAccess): OpsAccess {
  if (!access.permissions.includes("visepod.provision")) {
    throw new VisePodProvisioningAccessDeniedError();
  }
  return access;
}

export function resolveVisePodStudioEnvironment(
  value: string | undefined,
): VisePodStudioEnvironment {
  return VisePodStudioEnvironmentSchema.parse(value);
}

export function createInMemoryVisePodProvisioningService(
  authorizationService: OpsAuthorizationService,
  now: () => Date = () => new Date(),
): VisePodProvisioningService {
  const grants = new Map<string, VisePodProvisioningGrantRecord>();

  return {
    async issue(actor, environment) {
      requireVisePodProvisioningAccess(actor);
      const issuedAt = now();
      const token = createVisePodProvisioningToken();
      const grant: VisePodProvisioningGrantRecord = {
        tokenId: crypto.randomUUID(),
        tokenDigest: digestVisePodProvisioningToken(token),
        opsUserId: actor.userId,
        scope: VISEPOD_STUDIO_PROVISION_SCOPE,
        environment: VisePodStudioEnvironmentSchema.parse(environment),
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(
          issuedAt.getTime() + VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS * 1000,
        ).toISOString(),
        revokedAt: null,
      };
      grants.set(grant.tokenId, grant);
      return {
        token,
        scope: grant.scope,
        environment: grant.environment,
        expiresAt: grant.expiresAt,
      };
    },
    async validate(token, environment) {
      const digest = digestVisePodProvisioningToken(token);
      const grant = [...grants.values()].find((candidate) => candidate.tokenDigest === digest);
      if (!grant || grant.environment !== environment || grant.revokedAt !== null) return null;
      if (Date.parse(grant.expiresAt) <= now().getTime()) return null;
      const access = await authorizationService.getAccess(grant.opsUserId);
      if (!access || !access.permissions.includes("visepod.provision")) return null;
      return { grant: withoutDigest(grant), access };
    },
    async revoke(actor, grantId) {
      requireVisePodProvisioningAccess(actor);
      const grant = grants.get(grantId);
      if (!grant || grant.revokedAt !== null) throw new VisePodProvisioningAccessDeniedError();
      grant.revokedAt = now().toISOString();
    },
  };
}

function withoutDigest(record: VisePodProvisioningGrantRecord): VisePodStudioProvisioningGrant {
  const { tokenDigest: _tokenDigest, ...grant } = record;
  return grant;
}
