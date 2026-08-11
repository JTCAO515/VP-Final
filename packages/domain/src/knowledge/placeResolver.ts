import { z } from "zod";
import type { Poi } from "./index.js";

const MAX_EDIT_DISTANCE = 1;
const MIN_FUZZY_ALIAS_LENGTH = 5;

// Phase 1 keeps aliases in deterministic source code rather than a retrieval index. The map is
// intentionally narrow: it only supplements a POI when its canonical city/name already matches.
// Operators can still provide POI-specific aliases through `searchAliases`.
const KNOWN_PLACE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "Shanghai|the bund": ["外滩", "Waitan", "Wàitān", "Wai Tan", "Bund"],
  "Beijing|tiananmen square": ["天安门", "Tiananmen", "Tiān'ānmén"],
};

export const PoiReferenceResolutionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("resolved"),
    poiId: z.string().min(1),
    city: z.string().min(1),
    matchKind: z.enum(["exact", "fuzzy"]),
  }),
  z.object({
    status: z.literal("city_resolved"),
    city: z.string().min(1),
    matchKind: z.enum(["exact", "fuzzy"]),
  }),
  z.object({
    status: z.literal("ambiguous"),
    candidatePoiIds: z.array(z.string().min(1)).min(2),
  }),
  z.object({ status: z.literal("unresolved") }),
]);

export type PoiReferenceResolution = z.infer<typeof PoiReferenceResolutionSchema>;

export function resolvePoiReference(message: string, pois: readonly Poi[]): PoiReferenceResolution {
  const normalizedMessage = normalizePlaceText(message);
  if (!normalizedMessage) return { status: "unresolved" };

  const exactPoiIds = new Set<string>();
  for (const poi of pois) {
    if (placeAliasesForPoi(poi).some((alias) => messageContainsAlias(normalizedMessage, alias))) {
      exactPoiIds.add(poi.id);
    }
  }
  const exactResolution = resolvePoiCandidates(exactPoiIds, pois, "exact");
  if (exactResolution) return exactResolution;

  const fuzzyPoiIds = fuzzyPoiCandidates(normalizedMessage, pois);
  const fuzzyResolution = resolvePoiCandidates(fuzzyPoiIds, pois, "fuzzy");
  if (fuzzyResolution) return fuzzyResolution;

  return resolveCityReference(normalizedMessage, pois);
}

export function resolveCityReference(
  message: string,
  pois: readonly Poi[],
): PoiReferenceResolution {
  const normalizedMessage = normalizePlaceText(message);
  if (!normalizedMessage) return { status: "unresolved" };

  const cities = [...new Set(pois.map((poi) => poi.city))];
  const exactCities = cities.filter((city) =>
    messageContainsAlias(normalizedMessage, normalizePlaceText(city)),
  );
  if (exactCities.length === 1 && exactCities[0]) {
    return { status: "city_resolved", city: exactCities[0], matchKind: "exact" };
  }
  if (exactCities.length > 1) return { status: "unresolved" };

  const candidateCities = fuzzySingleTokenCandidates(normalizedMessage, cities);
  if (candidateCities.length === 1 && candidateCities[0]) {
    return { status: "city_resolved", city: candidateCities[0], matchKind: "fuzzy" };
  }
  return { status: "unresolved" };
}

function resolvePoiCandidates(
  candidateIds: ReadonlySet<string>,
  pois: readonly Poi[],
  matchKind: "exact" | "fuzzy",
): PoiReferenceResolution | null {
  const candidates = pois.filter((poi) => candidateIds.has(poi.id));
  if (candidates.length === 1 && candidates[0]) {
    return { status: "resolved", poiId: candidates[0].id, city: candidates[0].city, matchKind };
  }
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      candidatePoiIds: candidates.map((poi) => poi.id).sort(),
    };
  }
  return null;
}

function fuzzyPoiCandidates(message: string, pois: readonly Poi[]): Set<string> {
  const candidates = new Set<string>();
  for (const poi of pois) {
    const aliases = placeAliasesForPoi(poi).filter(isFuzzyAlias);
    if (fuzzySingleTokenCandidates(message, aliases).length > 0) candidates.add(poi.id);
  }
  return candidates;
}

function fuzzySingleTokenCandidates(message: string, values: readonly string[]): string[] {
  const tokens = message.match(/[a-z0-9]+/g) ?? [];
  const matches = new Set<string>();
  for (const value of values) {
    const normalized = normalizePlaceText(value);
    if (!isFuzzyAlias(normalized)) continue;
    if (tokens.some((token) => editDistanceAtMost(token, normalized, MAX_EDIT_DISTANCE))) {
      matches.add(value);
    }
  }
  return [...matches];
}

function placeAliasesForPoi(poi: Poi): string[] {
  const knownAliases = KNOWN_PLACE_ALIASES[placeAliasKey(poi)] ?? [];
  return [
    ...new Set([
      poi.nameEn,
      ...(poi.nameZh ? [poi.nameZh] : []),
      ...(poi.searchAliases ?? []),
      ...knownAliases,
    ]),
  ]
    .map(normalizePlaceText)
    .filter(Boolean);
}

function placeAliasKey(poi: Pick<Poi, "city" | "nameEn">): string {
  return `${poi.city}|${normalizePlaceText(poi.nameEn)}`;
}

function messageContainsAlias(message: string, alias: string): boolean {
  if (/[^a-z0-9 ]/i.test(alias)) return message.includes(alias);
  return ` ${message} `.includes(` ${alias} `);
}

function isFuzzyAlias(alias: string): boolean {
  return /^[a-z0-9]+$/.test(alias) && alias.length >= MIN_FUZZY_ALIAS_LENGTH;
}

function normalizePlaceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistanceAtMost(left: string, right: string, maximum: number): boolean {
  if (Math.abs(left.length - right.length) > maximum) return false;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = leftIndex;
    let rowMinimum = previous[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex] ?? rightIndex;
      const insertion = (previous[rightIndex - 1] ?? rightIndex - 1) + 1;
      const deletion = above + 1;
      const substitution = diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      diagonal = above;
      const next = Math.min(insertion, deletion, substitution);
      previous[rightIndex] = next;
      rowMinimum = Math.min(rowMinimum ?? next, next);
    }
    if ((rowMinimum ?? maximum + 1) > maximum) return false;
  }
  return (previous[right.length] ?? maximum + 1) <= maximum;
}
