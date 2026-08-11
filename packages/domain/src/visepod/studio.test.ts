import { describe, expect, it } from "vitest";
import {
  compareVisePodBindingIdempotency,
  isVisePodStudioProvisioningGrantUsable,
  VISEPOD_STUDIO_IDEMPOTENCY_RETENTION_DAYS,
  VISEPOD_STUDIO_PROVISION_SCOPE,
  VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS,
  VisePodBindingAuditMetadataSchema,
  VisePodBindingMutationResponseSchema,
  VisePodStudioErrorResponseSchema,
  VisePodStudioBindRequestSchema,
  VisePodStudioExactUserLookupRequestSchema,
  VisePodStudioExactUserLookupResponseSchema,
  VisePodStudioProvisioningGrantSchema,
  VisePodStudioProvisioningTokenIssueResponseSchema,
  VisePodStudioRevokeRequestSchema,
} from "./studio.js";

const actorId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const idempotencyKey = "00000000-0000-4000-8000-000000000003";

describe("VisePod Studio provisioning contract", () => {
  it("freezes one opaque eight-hour provision scope per environment", () => {
    expect(VISEPOD_STUDIO_PROVISION_SCOPE).toBe("visepod.provision");
    expect(VISEPOD_STUDIO_PROVISION_TOKEN_LIFETIME_SECONDS).toBe(8 * 60 * 60);
    expect(VISEPOD_STUDIO_IDEMPOTENCY_RETENTION_DAYS).toBe(30);
    expect(
      VisePodStudioProvisioningTokenIssueResponseSchema.parse({
        token: "studio-provisioning-token-0123456789",
        scope: "visepod.provision",
        environment: "development",
        expiresAt: "2026-08-11T08:00:00.000Z",
      }),
    ).toMatchObject({ environment: "development", scope: "visepod.provision" });

    const grant = {
      tokenId: "00000000-0000-4000-8000-000000000004",
      opsUserId: actorId,
      scope: "visepod.provision" as const,
      environment: "development" as const,
      issuedAt: "2026-08-11T00:00:00.000Z",
      expiresAt: "2026-08-11T08:00:00.000Z",
      revokedAt: null,
    };
    expect(
      isVisePodStudioProvisioningGrantUsable(
        grant,
        "development",
        new Date("2026-08-11T07:59:59.000Z"),
      ),
    ).toBe(true);
    expect(
      isVisePodStudioProvisioningGrantUsable(
        grant,
        "production",
        new Date("2026-08-11T07:59:59.000Z"),
      ),
    ).toBe(false);
    expect(
      isVisePodStudioProvisioningGrantUsable(
        { ...grant, revokedAt: "2026-08-11T01:00:00.000Z" },
        "development",
        new Date("2026-08-11T02:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      VisePodStudioProvisioningGrantSchema.safeParse({
        ...grant,
        expiresAt: "2026-08-11T07:59:59.000Z",
      }).success,
    ).toBe(false);
  });

  it("requires exactly one exact user identifier and never returns a raw email", () => {
    expect(
      VisePodStudioExactUserLookupRequestSchema.parse({ email: "traveler@example.test" }),
    ).toEqual({ email: "traveler@example.test" });
    expect(
      VisePodStudioExactUserLookupRequestSchema.safeParse({
        email: "traveler@example.test",
        userId,
      }).success,
    ).toBe(false);
    expect(VisePodStudioExactUserLookupRequestSchema.safeParse({}).success).toBe(false);
    expect(
      VisePodStudioExactUserLookupResponseSchema.parse({
        user: { userId, displayName: null, emailHint: "t***@example.test" },
      }),
    ).toMatchObject({ user: { emailHint: "t***@example.test" } });
    expect(
      VisePodStudioExactUserLookupResponseSchema.safeParse({
        user: { userId, displayName: null, emailHint: "traveler@example.test" },
      }).success,
    ).toBe(false);
  });

  it("returns one stable response for an idempotent replay and rejects a changed payload", () => {
    const first = {
      operation: "bind" as const,
      deviceId: "device-001",
      userId,
      idempotencyKey,
      reason: "Assign the demonstration device to the selected traveler.",
    };
    expect(compareVisePodBindingIdempotency(first, first)).toBe("replay");
    expect(compareVisePodBindingIdempotency(first, { ...first, userId: actorId })).toBe("conflict");
    expect(
      compareVisePodBindingIdempotency(first, {
        ...first,
        idempotencyKey: "00000000-0000-4000-8000-000000000004",
      }),
    ).toBe("new");

    expect(
      VisePodBindingMutationResponseSchema.parse({
        outcome: "created",
        idempotencyHit: true,
        binding: {
          deviceId: "device-001",
          userId,
          state: "active",
          boundAt: "2026-08-11T00:00:00.000Z",
          boundBy: actorId,
        },
      }),
    ).toMatchObject({ outcome: "created", idempotencyHit: true });
  });

  it("validates strict binding and revoke request bodies without duplicating the path device id", () => {
    expect(
      VisePodStudioBindRequestSchema.parse({
        userId,
        idempotencyKey,
        reason: "Assign the demonstration device to the selected traveler.",
      }),
    ).toMatchObject({ userId, idempotencyKey });
    expect(
      VisePodStudioBindRequestSchema.safeParse({
        userId,
        idempotencyKey,
        reason: "Assign the demonstration device to the selected traveler.",
        deviceId: "must-only-be-in-the-path",
      }).success,
    ).toBe(false);
    expect(
      VisePodStudioRevokeRequestSchema.parse({
        idempotencyKey,
        reason: "Remove the device from the completed demonstration.",
      }),
    ).toMatchObject({ idempotencyKey });
  });

  it("keeps audit metadata bounded to binding references and result", () => {
    expect(
      VisePodBindingAuditMetadataSchema.parse({
        deviceId: "device-001",
        previousUserId: null,
        nextUserId: userId,
        result: "succeeded",
      }),
    ).toMatchObject({ nextUserId: userId });
    expect(
      VisePodBindingAuditMetadataSchema.safeParse({
        deviceId: "device-001",
        previousUserId: null,
        nextUserId: userId,
        result: "succeeded",
        wifiPassword: "must-not-persist",
      }).success,
    ).toBe(false);
  });

  it("freezes the published error codes without accepting secret-bearing fields", () => {
    for (const code of [
      "PROVISIONING_ACCESS_DENIED",
      "DEVICE_NOT_FOUND",
      "USER_NOT_FOUND",
      "IDEMPOTENCY_KEY_CONFLICT",
    ] as const) {
      expect(VisePodStudioErrorResponseSchema.parse({ error: { code } })).toEqual({
        error: { code },
      });
    }
    expect(
      VisePodStudioErrorResponseSchema.safeParse({
        error: { code: "DEVICE_NOT_FOUND", token: "must-not-echo" },
      }).success,
    ).toBe(false);
  });
});
