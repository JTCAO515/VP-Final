import { describe, expect, it, vi } from "vitest";
import type { OutboundClickRecord } from "@visepanda/domain";
import { createInMemoryTelemetryService } from "../telemetry/service.js";
import { createCommerceService } from "./service.js";

const click: OutboundClickRecord = {
  id: "00000000-0000-4000-8000-000000000101",
  partner: "tripcom",
  targetUrl: "https://www.trip.com/hotels",
  userId: null,
  anonId: "a".repeat(43),
  createdAt: "2026-07-26T00:00:00.000Z",
};

describe("CommerceService", () => {
  it("records non-authoritative telemetry after the durable ledger write", async () => {
    const telemetry = createInMemoryTelemetryService();
    const service = createCommerceService({
      writer: {
        createRedirect: async () => ({
          click,
          redirectUrl: `${click.targetUrl}?vp_click_id=${click.id}`,
        }),
      },
      telemetryService: telemetry,
    });

    await service.createOutboundRedirect({
      identity: { kind: "anonymous", anonId: click.anonId! },
      partnerKey: click.partner,
      targetUrl: click.targetUrl,
      source: "explore",
      intent: "commerce_intent",
      entityId: "poi-1",
    });

    await expect(telemetry.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anon_id: click.anonId,
          action: "outbound_clicked",
          partner: click.partner,
          click_id: click.id,
        }),
        expect.objectContaining({
          anon_id: click.anonId,
          action: "partner_redirected",
          partner: click.partner,
          click_id: click.id,
        }),
      ]),
    );
  });

  it("does not wait for outbound telemetry before returning the durable redirect", async () => {
    const service = createCommerceService({
      writer: {
        createRedirect: async () => ({
          click,
          redirectUrl: `${click.targetUrl}?vp_click_id=${click.id}`,
        }),
      },
      telemetryService: {
        track: () => new Promise<never>(() => undefined),
      },
    });

    await expect(
      Promise.race([
        service.createOutboundRedirect({
          identity: { kind: "anonymous", anonId: click.anonId! },
          partnerKey: click.partner,
          targetUrl: click.targetUrl,
        }),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
      ]),
    ).resolves.toMatchObject({ click });
  });

  it("returns the durable redirect when non-authoritative telemetry fails", async () => {
    const onTelemetryError = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = createCommerceService({
      writer: {
        createRedirect: async () => ({
          click,
          redirectUrl: `${click.targetUrl}?vp_click_id=${click.id}`,
        }),
      },
      telemetryService: {
        track: async () => {
          throw new Error("telemetry offline");
        },
      },
      onTelemetryError,
    });

    await expect(
      service.createOutboundRedirect({
        identity: { kind: "anonymous", anonId: click.anonId! },
        partnerKey: click.partner,
        targetUrl: click.targetUrl,
      }),
    ).resolves.toMatchObject({ click });
    expect(onTelemetryError).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith("outbound_telemetry_write_failed", {
      failureClass: "persistence_error",
      clickId: click.id,
    });
    warn.mockRestore();
  });

  it("does not attempt telemetry when the authoritative ledger write fails", async () => {
    const track = vi.fn();
    const service = createCommerceService({
      writer: {
        createRedirect: async () => {
          throw new Error("ledger offline");
        },
      },
      telemetryService: { track },
    });

    await expect(
      service.createOutboundRedirect({
        identity: { kind: "anonymous", anonId: "a".repeat(43) },
        partnerKey: "tripcom",
        targetUrl: "https://www.trip.com/hotels",
      }),
    ).rejects.toThrow("ledger offline");
    expect(track).not.toHaveBeenCalled();
  });
});
