import {
  SeoPageIntentSchema,
  deriveSeoPageMatrix,
  type Poi,
  type SeoPageCandidate,
} from "@visepanda/domain";
import { toPublicPoiFact, type PublicPoiFactPresentation } from "./publicPoiFactPresentation";

export type PublicSeoPage = Readonly<{
  candidate: SeoPageCandidate;
  poi: Poi;
  facts: readonly PublicPoiFactPresentation[];
}>;

/**
 * Resolves a public page only from the shared evidence-gated matrix. A route with no current,
 * complete fact support has no page model and must not receive a fallback page.
 */
export function resolvePublicSeoPage(
  pois: readonly Poi[],
  input: { citySlug: string; poiSlug: string; intentSegment: string },
  now = new Date(),
): PublicSeoPage | null {
  const intent = SeoPageIntentSchema.safeParse(input.intentSegment.replaceAll("-", "_"));
  if (!intent.success) return null;

  const matrix = deriveSeoPageMatrix(pois, now);
  const candidate = matrix.pages.find(
    (page) =>
      page.citySlug === input.citySlug &&
      page.poiSlug === input.poiSlug &&
      page.intent === intent.data,
  );
  if (!candidate) return null;

  const poi = pois.find((entry) => entry.id === candidate.poiId);
  if (!poi) return null;

  const facts = candidate.supportingFactIds.flatMap((factId) => {
    const fact = poi.facts.find((entry) => entry.id === factId);
    if (!fact) return [];
    const presentation = toPublicPoiFact(fact, now);
    return presentation === null ? [] : [presentation];
  });
  if (facts.length !== candidate.supportingFactIds.length) return null;

  return { candidate, poi, facts };
}
