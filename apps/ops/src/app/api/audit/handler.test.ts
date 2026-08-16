import {
  createInMemoryOpsAuthorizationService,
  type OpsAccess,
  type OpsAuthorizationService,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { AuthorizedOpsRequest } from "../../../lib/opsAccess";
import { handleAuditLedgerGet } from "./handler";

const admin: OpsAccess = {
  userId: "43000000-0000-4000-8000-000000000001",
  role: "admin",
  permissions: ["membership.read"],
};

function authorization(service: OpsAuthorizationService): AuthorizedOpsRequest {
  return { access: admin, authorizationService: service, cookieResponse: NextResponse.next() };
}

describe("audit ledger route", () => {
  it("denies before an audit query can run", async () => {
    const service = createInMemoryOpsAuthorizationService();
    const listAudit = vi.spyOn(service, "listAudit");
    const response = await handleAuditLedgerGet(new Request("https://ops.example.test/api/audit"), {
      authorize: async () => NextResponse.json({ ok: false }, { status: 403 }),
    });

    expect(response.status).toBe(403);
    expect(listAudit).not.toHaveBeenCalled();
  });

  it("passes only exact bounded query filters to the authorized service", async () => {
    const service = createInMemoryOpsAuthorizationService([
      { userId: admin.userId, role: "admin" },
    ]);
    await service.recordAudit(admin, { action: "membership.set", targetType: "ops_membership" });
    const response = await handleAuditLedgerGet(
      new Request(
        `https://ops.example.test/api/audit?actorId=${admin.userId}&action=membership.set&limit=20`,
      ),
      { authorize: async () => authorization(service) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      events: [expect.objectContaining({ action: "membership.set" })],
    });
  });
});
