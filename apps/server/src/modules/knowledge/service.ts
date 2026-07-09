import { PoiSchema, isCurrentPoiFact, type Poi, type PoiCategory } from "@visepanda/domain";

export type KnowledgeService = {
  listPois(input?: { city?: string; category?: PoiCategory }): Promise<Poi[]>;
};

export function createInMemoryKnowledgeService(seed: Poi[] = []): KnowledgeService {
  return {
    async listPois(input = {}) {
      return seed
        .filter((poi) => !input.city || poi.city === input.city)
        .filter((poi) => !input.category || poi.category === input.category)
        .map((poi) =>
          PoiSchema.parse({
            ...poi,
            facts: poi.facts.filter((fact) => isCurrentPoiFact(fact)),
            commercialLinks: poi.commercialLinks.filter((link) => link.url.length > 0),
          }),
        );
    },
  };
}
