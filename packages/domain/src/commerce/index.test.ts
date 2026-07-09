import { describe, expect, it } from "vitest";
import { buildOutboundUrl } from "./index.js";

describe("buildOutboundUrl", () => {
  it("adds tracking to whitelisted partner hosts", () => {
    expect(
      buildOutboundUrl({
        partnerKey: "tripcom",
        targetUrl: "https://www.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toBe("https://www.trip.com/hotels?vp_click_id=click-1");
  });

  it("rejects disguised hostnames", () => {
    expect(() =>
      buildOutboundUrl({
        partnerKey: "tripcom",
        targetUrl: "https://www.trip.com.evil.example/hotels",
        clickId: "click-1",
      }),
    ).toThrow("not whitelisted");
  });

  it("rejects non-https targets", () => {
    expect(() =>
      buildOutboundUrl({
        partnerKey: "tripcom",
        targetUrl: "http://www.trip.com/hotels",
        clickId: "click-1",
      }),
    ).toThrow("https");
  });
});
