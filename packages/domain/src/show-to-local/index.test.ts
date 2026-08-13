import { describe, expect, it } from "vitest";

import {
  getShowToLocalPhraseCard,
  isAvailableShowToLocalPhrase,
  SHOW_TO_LOCAL_PHRASE_PACK,
  ShowToLocalPhrasePackSchema,
} from "./index.js";

describe("Show to Local phrase pack", () => {
  it("contains one versioned card for every declared travel scene", () => {
    expect(SHOW_TO_LOCAL_PHRASE_PACK.version).toBe("show-to-local-v1");
    expect(SHOW_TO_LOCAL_PHRASE_PACK.cards.map((card) => card.category)).toEqual([
      "restaurant",
      "taxi",
      "hotel",
      "allergy",
      "symptom",
      "emergency",
    ]);
    expect(ShowToLocalPhrasePackSchema.safeParse(SHOW_TO_LOCAL_PHRASE_PACK).success).toBe(true);
  });

  it("permits static Chinese only for ordinary cards", () => {
    const unavailable = SHOW_TO_LOCAL_PHRASE_PACK.cards.filter(
      (card) => !isAvailableShowToLocalPhrase(card),
    );
    expect(unavailable).toHaveLength(3);
    expect(JSON.stringify(unavailable)).not.toMatch(/[\u3400-\u9fff]/);

    for (const card of SHOW_TO_LOCAL_PHRASE_PACK.cards.filter(isAvailableShowToLocalPhrase)) {
      expect(card.chineseText).not.toBe("");
      expect(card.englishText).not.toBe("");
    }
  });

  it("keeps high-risk categories honestly unavailable without a reviewed fixed expression", () => {
    expect(getShowToLocalPhraseCard("allergy")).toMatchObject({
      availability: "unavailable",
      fallback:
        "I can’t safely create a card for this allergy or dietary restriction. Please use a verified card or ask the venue to confirm ingredients before consuming.",
    });
    expect(getShowToLocalPhraseCard("symptom")).toMatchObject({ availability: "unavailable" });
    expect(getShowToLocalPhraseCard("emergency")).toMatchObject({ availability: "unavailable" });
  });
});
