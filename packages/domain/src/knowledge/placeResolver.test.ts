import { describe, expect, it } from "vitest";
import { PoiSchema, type Poi } from "./index.js";
import { resolvePoiReference } from "./placeResolver.js";

function poi(input: Partial<Poi> & Pick<Poi, "id" | "city" | "nameEn">): Poi {
  return PoiSchema.parse({
    category: "attraction",
    sourceIds: {},
    facts: [],
    commercialLinks: [],
    ...input,
  });
}

const PLACES = [
  poi({ id: "poi-shanghai-bund", city: "Shanghai", nameEn: "The Bund", nameZh: "外滩" }),
  poi({
    id: "poi-beijing-tiananmen",
    city: "Beijing",
    nameEn: "Tiananmen Square",
    nameZh: "天安门",
  }),
  poi({ id: "poi-shanghai-peoples-park", city: "Shanghai", nameEn: "People's Park" }),
  poi({ id: "poi-chengdu-peoples-park", city: "Chengdu", nameEn: "People's Park" }),
];

describe("resolvePoiReference", () => {
  it.each(["the Bund", "外滩", "Waitan", "Wàitān", "Bund"])(
    "resolves %s to the same POI",
    (reference) => {
      expect(resolvePoiReference(`How do I reach ${reference}?`, PLACES)).toEqual({
        status: "resolved",
        poiId: "poi-shanghai-bund",
        city: "Shanghai",
        matchKind: "exact",
      });
    },
  );

  it("derives a city from a unique landmark without a city name", () => {
    expect(resolvePoiReference("Is Tiananmen open today?", PLACES)).toEqual({
      status: "resolved",
      poiId: "poi-beijing-tiananmen",
      city: "Beijing",
      matchKind: "exact",
    });
  });

  it("allows only a bounded one-character city typo", () => {
    expect(resolvePoiReference("What is near Beijng?", PLACES)).toEqual({
      status: "city_resolved",
      city: "Beijing",
      matchKind: "fuzzy",
    });
    expect(resolvePoiReference("What is near Beijxngg?", PLACES)).toEqual({
      status: "unresolved",
    });
  });

  it("returns ambiguity instead of guessing across cities", () => {
    expect(resolvePoiReference("Take me to People's Park", PLACES)).toEqual({
      status: "ambiguous",
      candidatePoiIds: ["poi-chengdu-peoples-park", "poi-shanghai-peoples-park"],
    });
  });

  it("returns an explicit unresolved result without a catalog fallback", () => {
    expect(resolvePoiReference("Where is an imaginary landmark?", PLACES)).toEqual({
      status: "unresolved",
    });
  });
});
