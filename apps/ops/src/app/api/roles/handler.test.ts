import {
  createInMemoryOpsAuthorizationService,
  type OpsAccess,
  type OpsAuthorizationService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { AuthorizedOpsRequest } from "../../../lib/opsAccess";
import { handleMembershipAssignByExactEmail, handleMembershipRevoke } from "./handler";

const admin: OpsAccess = {
  userId: "42000000-0000-4000-8000-000000000001",
  role: "admin",
  permissions: ["membership.read", "membership.write"],
};
const targetId = "42000000-0000-4000-8000-000000000002";

function authorization(service: OpsAuthorizationService): AuthorizedOpsRequest {
  return { access: admin, authorizationService: service, cookieResponse: NextResponse.next() };
}

function request(method: string, body: unknown) {
  return new Request("https://ops.example.test/api/roles", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Ops membership routes", () => {
  it("does not resolve an email before membership.write authorization", async () => {
    const service = createInMemoryOpsAuthorizationService();
    const lookup = vi.spyOn(service, "setMembershipByExactEmail");
    const response = await handleMembershipAssignByExactEmail(
      request("POST", { email: "person@example.test", role: "editor" }),
      {
        authorize: async () =>
          NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "无法分配成员资格。请在需要时先让对方自行注册。",
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("uses the same non-disclosing response when an exact email is not registered", async () => {
    const service = createInMemoryOpsAuthorizationService();
    const response = await handleMembershipAssignByExactEmail(
      request("POST", { email: "person@example.test", role: "editor" }),
      { authorize: async () => authorization(service) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "无法分配成员资格。请在需要时先让对方自行注册。",
    });
  });

  it("keeps an authorization-service outage honest rather than treating it as a missing account", async () => {
    const response = await handleMembershipAssignByExactEmail(
      request("POST", { email: "person@example.test", role: "editor" }),
      {
        authorize: async () =>
          NextResponse.json(
            { ok: false, error: "Ops authorization is unavailable." },
            { status: 503 },
          ),
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Ops authorization is unavailable.",
    });
  });

  it("delegates individual membership revocation to the protected service", async () => {
    const service = createInMemoryOpsAuthorizationService([
      { userId: admin.userId, role: "admin" },
      { userId: targetId, role: "operator" },
    ]);
    const response = await handleMembershipRevoke(request("DELETE", { userId: targetId }), {
      authorize: async () => authorization(service),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: targetId,
      revokedBy: admin.userId,
    });
    await expect(service.getAccess(targetId)).resolves.toBeNull();
  });
});
