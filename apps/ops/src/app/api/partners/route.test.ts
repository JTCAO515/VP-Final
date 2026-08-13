import {
  createInMemoryOpsAuthorizationService,
  createInMemoryPartnerAdministrationService,
  type OpsAccess,
} from "@visepanda/app-server";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import type { AuthorizedOpsRequest } from "../../../lib/opsAccess";
import {
  handlePartnerCreate,
  handlePartnerGet,
  handlePartnerStatusChange,
  handlePartnerUpdate,
  handlePartnersGet,
} from "./handler";

const admin: OpsAccess = {
  userId: "42000000-0000-4000-8000-000000000001",
  role: "admin",
  permissions: ["partner.read", "partner.write"],
};
const configuration = {
  key: "route_partner",
  hosts: ["route.example.com"],
  categories: ["hotel"],
  cities: ["Shanghai"],
  trackingParam: "vp_click_id",
};

function fixture() {
  const service = createInMemoryPartnerAdministrationService({ seed: [] });
  const authorization: AuthorizedOpsRequest = {
    access: admin,
    authorizationService: createInMemoryOpsAuthorizationService(),
    cookieResponse: NextResponse.next(),
  };
  return {
    service,
    dependencies: {
      authorize: async () => authorization,
      getService: () => service,
    },
  };
}

describe("/api/partners", () => {
  it("returns authorization failures before resolving the partner service", async () => {
    let serviceRequested = false;
    const response = await handlePartnersGet(new Request("https://ops.example.test/api/partners"), {
      authorize: async () =>
        NextResponse.json({ ok: false, error: "Ops authentication required." }, { status: 401 }),
      getService: () => {
        serviceRequested = true;
        return createInMemoryPartnerAdministrationService();
      },
    });
    expect(response.status).toBe(401);
    expect(serviceRequested).toBe(false);
  });

  it("creates pending configuration, updates it, and lists the current record", async () => {
    const setup = fixture();
    const created = await handlePartnerCreate(request("POST", configuration), setup.dependencies);
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      ok: true,
      partner: { key: "route_partner", kind: "ota", status: "pending" },
    });

    const updated = await handlePartnerUpdate(
      request("PUT", { ...configuration, cities: ["Beijing", "Shanghai"] }),
      setup.dependencies,
    );
    expect(updated.status).toBe(200);
    const listed = await handlePartnersGet(
      new Request("https://ops.example.test/api/partners"),
      setup.dependencies,
    );
    await expect(listed.json()).resolves.toMatchObject({
      partners: [{ status: "pending", cities: ["Beijing", "Shanghai"] }],
    });
    const detail = await handlePartnerGet(
      new Request("https://ops.example.test/api/partners/route_partner"),
      { params: Promise.resolve({ partnerKey: "route_partner" }) },
      setup.dependencies,
    );
    await expect(detail.json()).resolves.toMatchObject({
      partner: { key: "route_partner", status: "pending" },
    });
  });

  it("denies forbidden detail reads before resolving the partner service", async () => {
    let serviceRequested = false;
    const response = await handlePartnerGet(
      new Request("https://ops.example.test/api/partners/route_partner"),
      { params: Promise.resolve({ partnerKey: "route_partner" }) },
      {
        authorize: async () =>
          NextResponse.json(
            { ok: false, error: "This account cannot access partner configuration." },
            { status: 403 },
          ),
        getService: () => {
          serviceRequested = true;
          return createInMemoryPartnerAdministrationService();
        },
      },
    );
    expect(response.status).toBe(403);
    expect(serviceRequested).toBe(false);
  });

  it("returns not found for an unknown partner key", async () => {
    const setup = fixture();
    const response = await handlePartnerGet(
      new Request("https://ops.example.test/api/partners/missing_partner"),
      { params: Promise.resolve({ partnerKey: "missing_partner" }) },
      setup.dependencies,
    );
    expect(response.status).toBe(404);
  });

  it("rejects implicit activation and accepts a separately confirmed status action", async () => {
    const setup = fixture();
    await handlePartnerCreate(request("POST", configuration), setup.dependencies);

    const implicit = await handlePartnerStatusChange(
      request("PATCH", { key: "route_partner", status: "active" }),
      setup.dependencies,
    );
    expect(implicit.status).toBe(409);
    const explicit = await handlePartnerStatusChange(
      request("PATCH", {
        key: "route_partner",
        status: "active",
        confirmActivation: true,
      }),
      setup.dependencies,
    );
    await expect(explicit.json()).resolves.toMatchObject({ partner: { status: "active" } });
  });

  it("rejects unknown status, malformed host, and extra sensitive fields", async () => {
    const setup = fixture();
    for (const payload of [
      { key: "route_partner", status: "approved" },
      { ...configuration, hosts: ["https://route.example.com"] },
      { ...configuration, contact: "traveler@example.com" },
      { ...configuration, targetUrl: "https://route.example.com/book" },
      { ...configuration, cookie: "do-not-store" },
      { ...configuration, signature: "do-not-store" },
    ]) {
      const response =
        "status" in payload
          ? await handlePartnerStatusChange(request("PATCH", payload), setup.dependencies)
          : await handlePartnerCreate(request("POST", payload), setup.dependencies);
      expect(response.status).toBe(400);
    }
  });
});

function request(method: string, body: unknown): Request {
  return new Request("https://ops.example.test/api/partners", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
