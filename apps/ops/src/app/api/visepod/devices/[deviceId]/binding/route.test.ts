import {
  VisePodBindingDeviceNotFoundError,
  VisePodBindingIdempotencyConflictError,
  VisePodBindingProvisioningAccessDeniedError,
  VisePodBindingStateConflictError,
  VisePodBindingUserNotFoundError,
  type VisePodBindingService,
} from "@visepanda/app-server";
import { describe, expect, it } from "vitest";
import {
  handleVisePodBindingDelete,
  handleVisePodBindingGet,
  handleVisePodBindingPut,
} from "./handler";

const deviceId = "issue339-device-001";
const userId = "33900000-0000-4000-8000-000000000002";
const token = "provisioning-token-012345678901234567890123456789";
const context = { params: Promise.resolve({ deviceId }) };

function dependencies(service: VisePodBindingService) {
  return { getRuntime: () => ({ environment: "development" as const, service }) };
}

function request(method: string, body?: Record<string, string>) {
  return new Request(`https://ops.example.test/api/ops/visepod/devices/${deviceId}/binding`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const bindBody = {
  userId,
  idempotencyKey: "33900000-0000-4000-8000-000000000010",
  reason: "Assign the controlled demonstration device to the selected traveler.",
};

describe("VisePod binding routes", () => {
  it("rejects a malformed bearer before constructing any runtime service", async () => {
    let constructed = false;
    const response = await handleVisePodBindingGet(
      new Request("https://ops.example.test/api/ops/visepod/devices/issue339-device-001/binding"),
      context,
      {
        getRuntime: () => {
          constructed = true;
          throw new Error("must not build runtime");
        },
      },
    );
    expect(response.status).toBe(400);
    expect(constructed).toBe(false);
    await expect(response.json()).resolves.toEqual({ error: { code: "INVALID_REQUEST" } });
  });

  it("renders read, create, rebind, revoke, and replay response forms without leaking credentials", async () => {
    const service: VisePodBindingService = {
      get: async () => null,
      mutate: async ({ command }) => ({
        outcome: command.operation === "unbind" ? "revoked" : "created",
        idempotencyHit: false,
        binding:
          command.operation === "unbind"
            ? null
            : {
                deviceId: command.deviceId,
                userId: command.userId,
                state: "active",
                boundAt: "2026-08-13T00:00:00.000Z",
                boundBy: userId,
              },
      }),
    };
    const read = await handleVisePodBindingGet(request("GET"), context, dependencies(service));
    const create = await handleVisePodBindingPut(
      request("PUT", bindBody),
      context,
      dependencies(service),
    );
    const revoke = await handleVisePodBindingDelete(
      request("DELETE", {
        idempotencyKey: "33900000-0000-4000-8000-000000000011",
        reason: "Remove the device from the completed controlled demonstration.",
      }),
      context,
      dependencies(service),
    );
    expect(read.status).toBe(200);
    expect(create.status).toBe(201);
    expect(revoke.status).toBe(200);
    expect(await read.json()).toEqual({ binding: null });
    const serialized = JSON.stringify(await create.json());
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("wifi");
    expect(await revoke.json()).toMatchObject({ outcome: "revoked", binding: null });
  });

  it.each([
    [new VisePodBindingProvisioningAccessDeniedError(), 403, "PROVISIONING_ACCESS_DENIED"],
    [new VisePodBindingDeviceNotFoundError(), 404, "DEVICE_NOT_FOUND"],
    [new VisePodBindingUserNotFoundError(), 404, "USER_NOT_FOUND"],
    [new VisePodBindingIdempotencyConflictError(), 409, "IDEMPOTENCY_KEY_CONFLICT"],
    [new VisePodBindingStateConflictError(), 409, "BINDING_STATE_CONFLICT"],
  ] as const)("maps neutral %s errors", async (error, expectedStatus, code) => {
    const service: VisePodBindingService = {
      get: async () => {
        throw error;
      },
      mutate: async () => {
        throw error;
      },
    };
    const response = await handleVisePodBindingPut(
      request("PUT", bindBody),
      context,
      dependencies(service),
    );
    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toEqual({ error: { code } });
  });
});
