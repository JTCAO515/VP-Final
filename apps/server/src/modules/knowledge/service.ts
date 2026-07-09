import {
  INITIAL_POIS,
  PoiSchema,
  isCurrentPoiFact,
  updatePoiFact,
  type Poi,
  type PoiCategory,
} from "@visepanda/domain";

export type KnowledgeService = {
  listPois(input?: { city?: string; category?: PoiCategory }): Promise<Poi[]>;
  updateFact(input: { factId: string; value: Record<string, unknown> }): Promise<Poi[]>;
};

export function createInMemoryKnowledgeService(seed: Poi[] = INITIAL_POIS): KnowledgeService {
  let pois = seed;

  return {
    async listPois(input = {}) {
      return pois
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
    async updateFact(input) {
      pois = updatePoiFact(pois, input.factId, input.value);
      return this.listPois();
    },
  };
}
