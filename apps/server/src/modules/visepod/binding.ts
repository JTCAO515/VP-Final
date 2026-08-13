import { createHash } from "node:crypto";
import {
  VisePodBindingCommandSchema,
  VisePodBindingMutationResponseSchema,
  VisePodDeviceBindingReadResponseSchema,
  VisePodDeviceIdSchema,
  VisePodStudioEnvironmentSchema,
  type VisePodBindingCommand,
  type VisePodBindingMutationResponse,
  type VisePodDeviceBinding,
  type VisePodStudioEnvironment,
} from "@visepanda/domain";
import type { OpsAccess } from "../opsAuthorization/service.js";
import type { VisePodProvisioningService } from "./provisioning.js";

export type VisePodKnownDeviceCatalog = {
  has(deviceId: string): boolean;
};

export type VisePodBindingService = {
  get(input: {
    token: string;
    environment: VisePodStudioEnvironment;
    deviceId: string;
  }): Promise<VisePodDeviceBinding | null>;
  mutate(input: {
    token: string;
    environment: VisePodStudioEnvironment;
    command: VisePodBindingCommand;
  }): Promise<VisePodBindingMutationResponse>;
};

export class VisePodBindingProvisioningAccessDeniedError extends Error {
  constructor() {
    super("VisePod Studio provisioning access is unavailable.");
    this.name = "VisePodBindingProvisioningAccessDeniedError";
  }
}

export class VisePodBindingDeviceNotFoundError extends Error {
  constructor() {
    super("VisePod device is unavailable.");
    this.name = "VisePodBindingDeviceNotFoundError";
  }
}

export class VisePodBindingUserNotFoundError extends Error {
  constructor() {
    super("VisePod user is unavailable.");
    this.name = "VisePodBindingUserNotFoundError";
  }
}

export class VisePodBindingIdempotencyConflictError extends Error {
  constructor() {
    super("VisePod binding command conflicts with an existing request.");
    this.name = "VisePodBindingIdempotencyConflictError";
  }
}

export class VisePodBindingStateConflictError extends Error {
  constructor() {
    super("VisePod binding command cannot change the current binding state.");
    this.name = "VisePodBindingStateConflictError";
  }
}

/**
 * The controlled Studio path deliberately has a finite, deployment-owned device catalog.
 * It is not a fleet registry and carries no device secret, Wi-Fi credential, or user data.
 */
export function createVisePodKnownDeviceCatalog(
  deviceIds: Iterable<string>,
): VisePodKnownDeviceCatalog {
  const known = new Set<string>();
  for (const deviceId of deviceIds) known.add(VisePodDeviceIdSchema.parse(deviceId));
  return { has: (deviceId) => known.has(VisePodDeviceIdSchema.parse(deviceId)) };
}

export function resolveVisePodKnownDeviceCatalog(
  value: string | undefined,
): VisePodKnownDeviceCatalog {
  if (!value?.trim()) return createVisePodKnownDeviceCatalog([]);
  const deviceIds = value.split(",").map((deviceId) => deviceId.trim());
  if (deviceIds.some((deviceId) => !deviceId)) {
    throw new Error("VISEPOD_STUDIO_DEVICE_IDS must not contain empty device ids.");
  }
  const catalog = createVisePodKnownDeviceCatalog(deviceIds);
  if (new Set(deviceIds).size !== deviceIds.length) {
    throw new Error("VISEPOD_STUDIO_DEVICE_IDS must not contain duplicate device ids.");
  }
  return catalog;
}

export function canonicalVisePodBindingCommand(command: VisePodBindingCommand): string {
  const parsed = VisePodBindingCommandSchema.parse(command);
  return parsed.operation === "bind"
    ? ["bind", parsed.deviceId, parsed.userId, parsed.reason, parsed.idempotencyKey].join("\n")
    : ["unbind", parsed.deviceId, parsed.reason, parsed.idempotencyKey].join("\n");
}

export function digestVisePodBindingCommand(command: VisePodBindingCommand): string {
  return createHash("sha256").update(canonicalVisePodBindingCommand(command), "utf8").digest("hex");
}

export async function requireVisePodBindingProvisioningAccess(input: {
  provisioningService: VisePodProvisioningService;
  token: string;
  environment: VisePodStudioEnvironment;
}): Promise<OpsAccess> {
  const validated = await input.provisioningService.validate(
    input.token,
    VisePodStudioEnvironmentSchema.parse(input.environment),
  );
  if (!validated) throw new VisePodBindingProvisioningAccessDeniedError();
  return validated.access;
}

export function asVisePodBindingReadResponse(binding: VisePodDeviceBinding | null) {
  return VisePodDeviceBindingReadResponseSchema.parse({ binding });
}

export function asVisePodBindingMutationResponse(
  response: VisePodBindingMutationResponse,
): VisePodBindingMutationResponse {
  return VisePodBindingMutationResponseSchema.parse(response);
}
