import {
  createInMemoryOpsAuthorizationService,
  createInMemoryVisePodProvisioningService,
  type OpsAccess,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import type { AuthorizedOpsRequest } from "../../../../lib/opsAccess";
import { handleVisePodProvisioningToken } from "./handler";

const admin: OpsAccess = {
  userId: "33700000-0000-4000-8000-000000000001",
  role: "admin",
  permissions: [
    "membership.read",
    "membership.write",
    "partner.read",
    "partner.write",
    "cost.read",
    "visepod.provision",
  ],
};

describe("POST /api/visepod/provisioning-token", () => {
  it("authorizes before constructing the provisioning service", async () => {
    let requested = false;
    const response = await handleVisePodProvisioningToken(
      new Request("https://ops.example.test/api/visepod/provisioning-token", { method: "POST" }),
      {
        authorize: async () => NextResponse.json({ ok: false }, { status: 403 }),
        getService: () => {
          requested = true;
          return createInMemoryVisePodProvisioningService(createInMemoryOpsAuthorizationService());
        },
        environment: () => "development",
      },
    );
    expect(response.status).toBe(403);
    expect(requested).toBe(false);
  });

  it("returns an opaque token once without accepting client identity", async () => {
    const authorizationService = createInMemoryOpsAuthorizationService([
      { userId: admin.userId, role: "admin" },
    ]);
    const access: AuthorizedOpsRequest = {
      access: admin,
      authorizationService,
      cookieResponse: NextResponse.next(),
    };
    const response = await handleVisePodProvisioningToken(
      new Request("https://ops.example.test/api/visepod/provisioning-token", { method: "POST" }),
      {
        authorize: async () => access,
        getService: () => createInMemoryVisePodProvisioningService(authorizationService),
        environment: () => "development",
      },
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      scope: "visepod.provision",
      environment: "development",
    });
    expect(JSON.stringify(body)).not.toContain("tokenDigest");
  });
});
