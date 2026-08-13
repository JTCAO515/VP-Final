import { describe, expect, it } from "vitest";
import type { PartnerAuditInput } from "./partnerAdministration.js";
import type { OpsAccess } from "../opsAuthorization/service.js";
import {
  PartnerActivationConfirmationError,
  PartnerAdministrationForbiddenError,
  PartnerConfigurationConflictError,
  createInMemoryPartnerAdministrationService,
} from "./partnerAdministration.js";

const admin: OpsAccess = {
  userId: "40000000-0000-4000-8000-000000000001",
  role: "admin" as const,
  permissions: ["partner.read", "partner.write"],
};
const editor: OpsAccess = {
  userId: "40000000-0000-4000-8000-000000000002",
  role: "editor" as const,
  permissions: ["knowledge.read", "knowledge.write"],
};
const configuration = {
  key: "example_partner",
  hosts: ["travel.example.com"],
  categories: ["hotel"],
  cities: ["Shanghai"],
  trackingParam: "vp_click_id",
};

describe("Partner administration", () => {
  it("requires explicit Admin permissions for reads and writes", async () => {
    const service = createInMemoryPartnerAdministrationService({ seed: [] });
    await expect(service.listPartners(editor)).rejects.toThrow(PartnerAdministrationForbiddenError);
    await expect(service.getPartner(editor, "example_partner")).rejects.toThrow(
      PartnerAdministrationForbiddenError,
    );
    await expect(service.createPartner(editor, configuration)).rejects.toThrow(
      PartnerAdministrationForbiddenError,
    );
  });

  it("gets one configuration by immutable key and reports missing records", async () => {
    const service = createInMemoryPartnerAdministrationService({ seed: [] });
    await service.createPartner(admin, configuration);

    await expect(service.getPartner(admin, configuration.key)).resolves.toMatchObject({
      key: configuration.key,
      status: "pending",
    });
    await expect(service.getPartner(admin, "missing_partner")).rejects.toThrow(
      "The partner configuration was not found.",
    );
  });

  it("creates pending configuration and changes status only after explicit confirmation", async () => {
    const audit: PartnerAuditInput[] = [];
    const service = createInMemoryPartnerAdministrationService({
      seed: [],
      onAudit: (event) => audit.push(event),
    });

    await expect(service.createPartner(admin, configuration)).resolves.toMatchObject({
      key: "example_partner",
      kind: "ota",
      status: "pending",
    });
    await expect(
      service.changePartnerStatus(admin, {
        key: "example_partner",
        status: "active",
      }),
    ).rejects.toThrow(PartnerActivationConfirmationError);
    await expect(
      service.changePartnerStatus(admin, {
        key: "example_partner",
        status: "active",
        confirmActivation: true,
      }),
    ).resolves.toMatchObject({ status: "active" });

    expect(audit).toEqual([
      expect.objectContaining({ action: "partner.created" }),
      expect.objectContaining({
        action: "partner.status.changed",
        metadata: { previousStatus: "pending", currentStatus: "active" },
      }),
    ]);
  });

  it("rejects duplicate hosts and extra contact or target fields", async () => {
    const service = createInMemoryPartnerAdministrationService({ seed: [] });
    await service.createPartner(admin, configuration);
    await expect(
      service.createPartner(admin, {
        ...configuration,
        key: "duplicate_partner",
      }),
    ).rejects.toThrow(PartnerConfigurationConflictError);
    await expect(
      service.createPartner(admin, {
        ...configuration,
        key: "unsafe_partner",
        hosts: ["unsafe.example.com"],
        contact: "operator@example.com",
        targetUrl: "https://unsafe.example.com/book",
      } as typeof configuration),
    ).rejects.toThrow();
  });

  it("updates configuration without changing status or copying values into audit metadata", async () => {
    const audit: PartnerAuditInput[] = [];
    const service = createInMemoryPartnerAdministrationService({
      seed: [],
      onAudit: (event) => audit.push(event),
    });
    await service.createPartner(admin, configuration);
    await service.updatePartner(admin, {
      ...configuration,
      hosts: ["www.travel.example.com"],
      cities: ["Beijing", "Shanghai"],
    });

    await expect(service.listPartners(admin)).resolves.toEqual([
      expect.objectContaining({
        hosts: ["www.travel.example.com"],
        cities: ["Beijing", "Shanghai"],
        status: "pending",
      }),
    ]);
    expect(audit[1]).toEqual({
      action: "partner.updated",
      targetType: "partner",
      targetId: "example_partner",
      metadata: { changedFields: ["hosts", "cities"] },
    });
    expect(JSON.stringify(audit)).not.toContain("www.travel.example.com");
    expect(JSON.stringify(audit)).not.toContain("vp_click_id");
  });

  it("retains creator type as audited configuration without activating or exposing a link", async () => {
    const audit: PartnerAuditInput[] = [];
    const service = createInMemoryPartnerAdministrationService({
      seed: [],
      onAudit: (event) => audit.push(event),
    });

    await expect(
      service.createPartner(admin, { ...configuration, key: "creator_partner", kind: "creator" }),
    ).resolves.toMatchObject({ key: "creator_partner", kind: "creator", status: "pending" });

    expect(audit).toEqual([
      expect.objectContaining({
        action: "partner.created",
        metadata: { changedFields: ["hosts", "categories", "cities", "trackingParam", "kind"] },
      }),
    ]);
  });
});
