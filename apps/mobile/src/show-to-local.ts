import { isAvailableShowToLocalPhrase, type ShowToLocalPhraseCard } from "@visepanda/domain";

export function canCopyOrSpeakShowToLocalCard(card: ShowToLocalPhraseCard): boolean {
  return isAvailableShowToLocalPhrase(card);
}

export function showToLocalAccessibilityLabel(card: ShowToLocalPhraseCard): string {
  return card.availability === "available"
    ? `Open ${card.title} phrase card`
    : `${card.title} verified card unavailable`;
}
