import { describe, expect, it } from "vitest";
import {
  CreatorReferralSchema,
  OutboundClickRecordSchema,
  PartnerSchema,
  buildApprovedOutboundUrl,
  buildOutboundUrl,
} from "./index.js";

const activePartner = {
  key: "tripcom",
  hosts: ["trip.com", "www.trip.com"],
  categories: ["hotel"],
  cities: ["Shanghai"],
  trackingParam: "vp_click_id",
  kind: "ota" as const,
  status: "active" as const,
};

describe("buildOutboundUrl", () => {
  it("adds tracking to whitelisted partner hosts", () => {
    expect(
      buildApprovedOutboundUrl({
        partner: activePartner,
        targetUrl: "https://www.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toBe("https://www.trip.com/hotels?vp_click_id=click-1");
  });

  it("rejects pending static partners", () => {
    expect(() =>
      buildOutboundUrl({
        partnerKey: "tripcom",
        targetUrl: "https://www.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toThrow("not active");
  });

  it("defaults existing partner configurations to OTA and never routes creators outbound", () => {
    expect(PartnerSchema.parse({ ...activePartner, kind: undefined }).kind).toBe("ota");
    expect(() =>
      buildApprovedOutboundUrl({
        partner: { ...activePartner, kind: "creator" },
        targetUrl: "https://www.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toThrow("not outbound destinations");
  });

  it("rejects disguised hostnames", () => {
    expect(() =>
      buildApprovedOutboundUrl({
        partner: activePartner,
        targetUrl: "https://www.trip.com.evil.example/hotels",
        clickId: "click-1",
      }),
    ).toThrow("not whitelisted");

    expect(() =>
      buildApprovedOutboundUrl({
        partner: activePartner,
        targetUrl: "https://offers.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toThrow("not whitelisted");
  });

  it("rejects non-https targets", () => {
    expect(() =>
      buildApprovedOutboundUrl({
        partner: activePartner,
        targetUrl: "http://www.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toThrow("HTTPS");
  });

  it("rejects credential-bearing outbound URLs", () => {
    expect(() =>
      buildApprovedOutboundUrl({
        partner: activePartner,
        targetUrl: "https://traveler:secret@www.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toThrow("without credentials");
  });

  it("replaces a conflicting partner tracking value", () => {
    expect(
      buildApprovedOutboundUrl({
        partner: activePartner,
        targetUrl: "https://www.trip.com/hotels?vp_click_id=untrusted#offers",
        clickId: "click-1",
      }),
    ).toBe("https://www.trip.com/hotels?vp_click_id=click-1#offers");
  });

  it("rejects malformed or duplicate partner host configuration", () => {
    expect(() => PartnerSchema.parse({ ...activePartner, hosts: ["https://trip.com"] })).toThrow(
      "bare DNS",
    );
    expect(() =>
      PartnerSchema.parse({ ...activePartner, hosts: ["trip.com", "trip.com"] }),
    ).toThrow("unique");
  });

  it("requires exactly one trusted identity on retained click records", () => {
    const base = {
      id: "click-1",
      partner: "tripcom",
      targetUrl: "https://www.trip.com/hotels",
      source: "copilot",
      intent: "commerce_intent",
      createdAt: "2026-07-26T00:00:00.000Z",
    };

    expect(
      OutboundClickRecordSchema.parse({ ...base, userId: null, anonId: "a".repeat(43) }).anonId,
    ).toBe("a".repeat(43));
    expect(() => OutboundClickRecordSchema.parse({ ...base, userId: null, anonId: null })).toThrow(
      "exactly one",
    );
    expect(() =>
      OutboundClickRecordSchema.parse({
        ...base,
        userId: "70000000-0000-4000-8000-000000000001",
        anonId: "a".repeat(43),
      }),
    ).toThrow("exactly one");
  });

  it("accepts only a same-origin, bounded creator landing path", () => {
    const referral = CreatorReferralSchema.parse({
      key: "shanghai_creator_01",
      partnerKey: "creator_shanghai",
      landingPath: "/visepanda",
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    });
    expect(referral.landingPath).toBe("/visepanda");
    expect(() =>
      CreatorReferralSchema.parse({ ...referral, landingPath: "//evil.example" }),
    ).toThrow();
    expect(() =>
      CreatorReferralSchema.parse({ ...referral, landingPath: "/visepanda?source=raw" }),
    ).toThrow();
  });
});
