import { INITIAL_POIS, derivePoiSceneTags, type Poi } from "@visepanda/domain";

export type PoiSeoEntry = {
  citySlug: string;
  poiSlug: string;
  poi: Poi;
};

export function poiEntries(): PoiSeoEntry[] {
  return INITIAL_POIS.map((poi) => ({
    citySlug: slugify(poi.city),
    poiSlug: slugify(poi.nameEn),
    poi,
  }));
}

export function findPoiEntry(citySlug: string, poiSlug: string): PoiSeoEntry | undefined {
  return poiEntries().find((entry) => entry.citySlug === citySlug && entry.poiSlug === poiSlug);
}

export function poiDescription(poi: Poi): string {
  const tags = derivePoiSceneTags(poi);
  return tags.length > 0
    ? `${poi.nameEn} in ${poi.city}: ${tags.join(", ")}.`
    : `${poi.nameEn} in ${poi.city}, curated for China travel planning.`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
