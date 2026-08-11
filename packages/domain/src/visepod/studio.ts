import { z } from "zod";
import { VisePodDeviceIdSchema } from "./index.js";

export const VISEPOD_STUDIO_PROVISION_SCOPE = "visepod.provision" as const;
export const VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
export const VISEPOD_STUDIO_IDEMPOTENCY_RETENTION_DAYS = 30;

export const VisePodStudioEnvironmentSchema = z.enum(["development", "production"]);
export type VisePodStudioEnvironment = z.infer<typeof VisePodStudioEnvironmentSchema>;

export const VisePodStudioProvisionScopeSchema = z.literal(VISEPOD_STUDIO_PROVISION_SCOPE);

export const VisePodStudioProvisioningTokenSchema = z
  .string()
  .trim()
  .min(24)
  .max(512)
  .regex(/^[A-Za-z0-9._~-]+$/, "Provisioning tokens must be opaque unreserved strings");

export const VisePodStudioProvisioningTokenIssueResponseSchema = z
  .object({
    token: VisePodStudioProvisioningTokenSchema,
    scope: VisePodStudioProvisionScopeSchema,
    environment: VisePodStudioEnvironmentSchema,
    expiresAt: z.string().datetime(),
  })
  .strict();

const VisePodStudioUserIdSchema = z.string().uuid();
const VisePodStudioReasonSchema = z.string().trim().min(10).max(500);
const VisePodStudioIdempotencyKeySchema = z.string().uuid();

export const VisePodStudioProvisioningGrantSchema = z
  .object({
    tokenId: z.string().uuid(),
    opsUserId: VisePodStudioUserIdSchema,
    scope: VisePodStudioProvisionScopeSchema,
    environment: VisePodStudioEnvironmentSchema,
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    revokedAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((grant, context) => {
    const lifetimeMs = Date.parse(grant.expiresAt) - Date.parse(grant.issuedAt);
    if (lifetimeMs !== VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "expiresAt must be exactly eight hours after issuedAt",
      });
    }
  });

export const VisePodStudioExactUserLookupRequestSchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    userId: VisePodStudioUserIdSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (Number(input.email !== undefined) + Number(input.userId !== undefined) !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one exact user identifier",
      });
    }
  });

export const VisePodStudioMaskedEmailSchema = z
  .string()
  .trim()
  .max(320)
  .regex(/^[^@\s]*\*{3,}[^@\s]*@[^@\s]+$/, "emailHint must be masked");

export const VisePodStudioResolvedUserSchema = z
  .object({
    userId: VisePodStudioUserIdSchema,
    displayName: z.string().trim().min(1).max(100).nullable(),
    emailHint: VisePodStudioMaskedEmailSchema.nullable(),
  })
  .strict();

export const VisePodStudioExactUserLookupResponseSchema = z
  .object({
    user: VisePodStudioResolvedUserSchema,
  })
  .strict();

export const VisePodDeviceBindingSchema = z
  .object({
    deviceId: VisePodDeviceIdSchema,
    userId: VisePodStudioUserIdSchema,
    state: z.literal("active"),
    boundAt: z.string().datetime(),
    boundBy: VisePodStudioUserIdSchema,
  })
  .strict();

export const VisePodDeviceBindingReadResponseSchema = z
  .object({
    binding: VisePodDeviceBindingSchema.nullable(),
  })
  .strict();

export const VisePodStudioBindRequestSchema = z
  .object({
    userId: VisePodStudioUserIdSchema,
    idempotencyKey: VisePodStudioIdempotencyKeySchema,
    reason: VisePodStudioReasonSchema,
  })
  .strict();

export const VisePodStudioRevokeRequestSchema = z
  .object({
    idempotencyKey: VisePodStudioIdempotencyKeySchema,
    reason: VisePodStudioReasonSchema,
  })
  .strict();

export const VisePodBindingCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("bind"),
      deviceId: VisePodDeviceIdSchema,
      userId: VisePodStudioUserIdSchema,
      idempotencyKey: VisePodStudioIdempotencyKeySchema,
      reason: VisePodStudioReasonSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("unbind"),
      deviceId: VisePodDeviceIdSchema,
      idempotencyKey: VisePodStudioIdempotencyKeySchema,
      reason: VisePodStudioReasonSchema,
    })
    .strict(),
]);

export const VisePodBindingMutationKindSchema = z.enum(["created", "rebound", "revoked"]);

export const VisePodBindingMutationResponseSchema = z
  .object({
    outcome: VisePodBindingMutationKindSchema,
    idempotencyHit: z.boolean(),
    binding: VisePodDeviceBindingSchema.nullable(),
  })
  .strict();

export const VisePodStudioErrorCodeSchema = z.enum([
  "PROVISIONING_ACCESS_DENIED",
  "DEVICE_NOT_FOUND",
  "USER_NOT_FOUND",
  "IDEMPOTENCY_KEY_CONFLICT",
]);

export const VisePodStudioErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: VisePodStudioErrorCodeSchema,
      })
      .strict(),
  })
  .strict();

export const VisePodBindingAuditActionSchema = z.enum([
  "visepod.binding.created",
  "visepod.binding.rebound",
  "visepod.binding.revoked",
]);

export const VisePodBindingAuditResultSchema = z.enum(["succeeded", "rejected"]);

export const VisePodBindingAuditMetadataSchema = z
  .object({
    deviceId: VisePodDeviceIdSchema,
    previousUserId: VisePodStudioUserIdSchema.nullable(),
    nextUserId: VisePodStudioUserIdSchema.nullable(),
    result: VisePodBindingAuditResultSchema,
  })
  .strict();

export type VisePodStudioProvisioningTokenIssueResponse = z.infer<
  typeof VisePodStudioProvisioningTokenIssueResponseSchema
>;
export type VisePodStudioProvisioningGrant = z.infer<typeof VisePodStudioProvisioningGrantSchema>;
export type VisePodStudioExactUserLookupRequest = z.infer<
  typeof VisePodStudioExactUserLookupRequestSchema
>;
export type VisePodStudioResolvedUser = z.infer<typeof VisePodStudioResolvedUserSchema>;
export type VisePodDeviceBinding = z.infer<typeof VisePodDeviceBindingSchema>;
export type VisePodBindingCommand = z.infer<typeof VisePodBindingCommandSchema>;
export type VisePodBindingMutationResponse = z.infer<typeof VisePodBindingMutationResponseSchema>;
export type VisePodBindingAuditMetadata = z.infer<typeof VisePodBindingAuditMetadataSchema>;

export function isVisePodStudioProvisioningGrantUsable(
  grant: VisePodStudioProvisioningGrant,
  environment: VisePodStudioEnvironment,
  at: Date,
): boolean {
  const validated = VisePodStudioProvisioningGrantSchema.parse(grant);
  return (
    validated.environment === environment &&
    validated.revokedAt === null &&
    Date.parse(validated.expiresAt) > at.getTime()
  );
}

export function compareVisePodBindingIdempotency(
  existing: VisePodBindingCommand,
  incoming: VisePodBindingCommand,
): "new" | "replay" | "conflict" {
  const left = VisePodBindingCommandSchema.parse(existing);
  const right = VisePodBindingCommandSchema.parse(incoming);
  if (left.idempotencyKey !== right.idempotencyKey) return "new";
  return JSON.stringify(left) === JSON.stringify(right) ? "replay" : "conflict";
}
