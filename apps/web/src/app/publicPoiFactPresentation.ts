import { isEligiblePoiFact, type PoiFact } from "@visepanda/domain";

const PUBLIC_SOURCE_LABELS = {
  official: "Official source",
  operator_verified: "Operator verified",
  reputable_editorial: "Independent editorial",
} as const;

type PublicSourceClass = keyof typeof PUBLIC_SOURCE_LABELS;

export type PublicPoiFactProvenance = {
  sourceClass: PublicSourceClass;
  sourceLabel: string;
  verifiedAt: string;
  verifiedDateLabel: string;
};

export type PublicPoiFactPresentation = {
  id: string;
  factType: string;
  label: string;
  provenance: PublicPoiFactProvenance;
};

export function projectPublicPoiFactProvenance(
  fact: PoiFact,
  now = new Date(),
): PublicPoiFactProvenance | null {
  if (!isEligiblePoiFact(fact, now) || fact.verifiedAt === null) return null;

  const sourceClass = fact.sourceClass;
  if (sourceClass === null || !(sourceClass in PUBLIC_SOURCE_LABELS)) return null;

  return {
    sourceClass: sourceClass as PublicSourceClass,
    sourceLabel: PUBLIC_SOURCE_LABELS[sourceClass as PublicSourceClass],
    verifiedAt: fact.verifiedAt,
    verifiedDateLabel: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }).format(new Date(fact.verifiedAt)),
  };
}

export function toPublicPoiFact(fact: PoiFact, now = new Date()): PublicPoiFactPresentation | null {
  const provenance = projectPublicPoiFactProvenance(fact, now);
  const label = fact.value.label;
  if (provenance === null || typeof label !== "string" || label.trim().length === 0) return null;

  return {
    id: fact.id,
    factType: fact.factType,
    label: label.trim(),
    provenance,
  };
}
