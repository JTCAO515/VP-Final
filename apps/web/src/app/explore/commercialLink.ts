import type { Poi } from "@visepanda/domain";

type PoiCommercialLink = Poi["commercialLinks"][number];

/**
 * Explore never renders a partner URL directly. The outbound gateway validates
 * the active partner, records the click, then performs the redirect.
 */
export function exploreCommercialLinkHref(link: PoiCommercialLink, poiId: string): string {
  const query = new URLSearchParams({
    partner: link.partner,
    url: link.url,
    source: "explore",
    intent: "commerce_intent",
    entityId: poiId,
  });
  return `/outbound?${query.toString()}`;
}
