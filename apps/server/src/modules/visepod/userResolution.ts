import { createHash } from "node:crypto";
import {
  VisePodStudioExactUserLookupRequestSchema,
  VisePodStudioResolvedUserSchema,
  type VisePodStudioEnvironment,
  type VisePodStudioExactUserLookupRequest,
  type VisePodStudioResolvedUser,
} from "@visepanda/domain";
import type { VisePodProvisioningService } from "./provisioning.js";
import { requireVisePodBindingProvisioningAccess } from "./binding.js";
import type { VisePodStudioUserLookupRateLimiter } from "./userLookupLimiter.js";

export type VisePodUserResolutionService = {
  resolve(input: {
    token: string;
    environment: VisePodStudioEnvironment;
    request: VisePodStudioExactUserLookupRequest;
  }): Promise<VisePodStudioResolvedUser>;
};

export class VisePodUserLookupNotFoundError extends Error {
  constructor() {
    super("VisePod user is unavailable.");
    this.name = "VisePodUserLookupNotFoundError";
  }
}

export class VisePodUserLookupRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("VisePod user lookup is rate limited.");
    this.name = "VisePodUserLookupRateLimitedError";
  }
}

/**
 * Resolves authorization before a caller may inspect a requested identifier. The durable
 * adapter supplies the exact database lookup and audit write; this boundary owns the
 * non-enumeration policy shared by every future consumer.
 */
export async function requireVisePodUserLookupAccess(input: {
  provisioningService: VisePodProvisioningService;
  rateLimiter: VisePodStudioUserLookupRateLimiter;
  token: string;
  environment: VisePodStudioEnvironment;
}) {
  const access = await requireVisePodBindingProvisioningAccess({
    provisioningService: input.provisioningService,
    token: input.token,
    environment: input.environment,
  });
  const admission = await input.rateLimiter.check(access.userId);
  if (!admission.allowed) {
    throw new VisePodUserLookupRateLimitedError(admission.retryAfterSeconds);
  }
  return access;
}

export function exactUserLookupIdentifier(input: VisePodStudioExactUserLookupRequest): {
  kind: "email" | "user_id";
  value: string;
} {
  const parsed = VisePodStudioExactUserLookupRequestSchema.parse(input);
  return parsed.email !== undefined
    ? { kind: "email", value: parsed.email }
    : { kind: "user_id", value: parsed.userId! };
}

/** A one-way audit identifier; raw emails and UUIDs never enter audit metadata. */
export function digestVisePodUserLookupIdentifier(
  input: VisePodStudioExactUserLookupRequest,
): string {
  const identifier = exactUserLookupIdentifier(input);
  return createHash("sha256")
    .update(`visepod:exact-user-lookup:${identifier.kind}:${identifier.value}`, "utf8")
    .digest("hex");
}

export function maskVisePodUserLookupEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain, ...extra] = email.split("@");
  if (!local || !domain || extra.length > 0) return null;
  return `${local.slice(0, 1)}***@${domain}`;
}

export function asVisePodResolvedUser(input: {
  userId: string;
  email: string | null;
}): VisePodStudioResolvedUser {
  return VisePodStudioResolvedUserSchema.parse({
    userId: input.userId,
    displayName: null,
    emailHint: maskVisePodUserLookupEmail(input.email),
  });
}
