import { describe, expect, it } from "vitest";
import { listOutboundClicks, recordOutboundClick } from "./ledger";

describe("outbound ledger", () => {
  it("records clicks", () => {
    const before = listOutboundClicks().length;

    recordOutboundClick({
      id: `click-${before + 1}`,
      partner: "tripcom",
      targetUrl: "https://www.trip.com/hotels",
      createdAt: "2026-07-09T00:00:00.000Z",
    });

    expect(listOutboundClicks()).toHaveLength(before + 1);
  });
});
