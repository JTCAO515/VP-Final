import { describe, expect, it } from "vitest";
import { exploreCommercialLinkHref } from "./commercialLink";

describe("exploreCommercialLinkHref", () => {
  it("sends the active POI link through the outbound gateway with bounded attribution", () => {
    const href = exploreCommercialLinkHref(
      {
        id: "link-1",
        poiId: "poi-1",
        partner: "klook",
        url: "https://www.klook.com/en-US/activity/example?locale=en-US",
        disclosure: "We may earn a commission when you continue to Klook.",
      },
      "poi-1",
    );

    expect(href).toBe(
      "/outbound?partner=klook&url=https%3A%2F%2Fwww.klook.com%2Fen-US%2Factivity%2Fexample%3Flocale%3Den-US&source=explore&intent=commerce_intent&entityId=poi-1",
    );
  });
});
