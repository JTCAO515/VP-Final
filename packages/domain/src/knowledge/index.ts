import { z } from "zod";

export const PoiCategorySchema = z.enum(["food", "attraction", "hotel", "shopping", "experience"]);

export const PoiFactSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  factType: z.string().min(1),
  value: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1),
  verifiedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().default(null),
  version: z.number().int().positive(),
});

export const PoiCommercialLinkSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  partner: z.string().min(1),
  url: z.string().url(),
  disclosure: z.string().min(1),
});

export const PoiSchema = z.object({
  id: z.string().min(1),
  city: z.string().min(1),
  category: PoiCategorySchema,
  nameEn: z.string().min(1),
  nameZh: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  sourceIds: z.record(z.unknown()).default({}),
  facts: z.array(PoiFactSchema).default([]),
  commercialLinks: z.array(PoiCommercialLinkSchema).default([]),
});

export const KnowledgeGapSchema = z.object({
  id: z.string().min(1),
  questionPattern: z.string().min(1),
  frequency: z.number().int().positive(),
  city: z.string().optional(),
  status: z.enum(["open", "resolved", "ignored"]),
});

export type PoiCategory = z.infer<typeof PoiCategorySchema>;
export type PoiFact = z.infer<typeof PoiFactSchema>;
export type Poi = z.infer<typeof PoiSchema>;
export type KnowledgeGap = z.infer<typeof KnowledgeGapSchema>;

export function isCurrentPoiFact(fact: PoiFact, now = new Date()): boolean {
  return !fact.expiresAt || Date.parse(fact.expiresAt) >= now.getTime();
}
