import { getShowToLocalPhraseCard } from "@visepanda/domain";
import { expect, it } from "vitest";

import { canCopyOrSpeakShowToLocalCard, showToLocalAccessibilityLabel } from "./show-to-local.js";

it("only exposes copy and local speech for ordinary available phrase cards", () => {
  expect(canCopyOrSpeakShowToLocalCard(getShowToLocalPhraseCard("restaurant"))).toBe(true);
  expect(canCopyOrSpeakShowToLocalCard(getShowToLocalPhraseCard("allergy"))).toBe(false);
});

it("describes unavailable high-risk cards without implying an action exists", () => {
  expect(showToLocalAccessibilityLabel(getShowToLocalPhraseCard("emergency"))).toBe(
    "Emergency help verified card unavailable",
  );
});
