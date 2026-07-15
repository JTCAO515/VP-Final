import { isEligiblePoiFact, type Poi, type PoiFact } from "@visepanda/domain";

const FACT_LABELS = {
  payment_acceptance: "Payment",
  metro_access: "Metro",
  booking_required: "Booking",
  reservation_helpful: "Booking",
  crowd_pattern: "Crowds",
  rainy_fit: "Rain",
} as const;

export type ExploreFact = {
  id: string;
  kind: (typeof FACT_LABELS)[keyof typeof FACT_LABELS];
  label: string;
};

export function deriveExploreFacts(poi: Poi, now = new Date()): ExploreFact[] {
  return poi.facts.flatMap((fact) => {
    if (!isEligiblePoiFact(fact, now)) return [];

    const kind = FACT_LABELS[fact.factType as keyof typeof FACT_LABELS];
    const label = factLabel(fact);
    return kind && label ? [{ id: fact.id, kind, label }] : [];
  });
}

function factLabel(fact: PoiFact): string | null {
  const label = fact.value.label;
  return typeof label === "string" && label.trim().length > 0 ? label.trim() : null;
}
