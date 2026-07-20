import type { Poi } from "@visepanda/domain";
import { toPublicPoiFact, type PublicPoiFactProvenance } from "../publicPoiFactPresentation";

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
  provenance: PublicPoiFactProvenance;
};

export function deriveExploreFacts(poi: Poi, now = new Date()): ExploreFact[] {
  return poi.facts.flatMap((fact) => {
    const presentation = toPublicPoiFact(fact, now);
    if (presentation === null) return [];

    const kind = FACT_LABELS[presentation.factType as keyof typeof FACT_LABELS];
    return kind ? [{ ...presentation, kind }] : [];
  });
}
