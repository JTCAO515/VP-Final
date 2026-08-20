import { z } from "zod";
import { PoiFactSchema, isEligibleFactLifecycle } from "./index.js";

export const ExecutionMomentSchema = z.enum([
  "payment",
  "show_to_local",
  "entry_booking",
  "translate_communicate",
  "network",
  "rescue_human_help",
]);

const ExecutionCitySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((city) => city.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("en-US"));

const PoiExecutionFactTargetSchema = z
  .object({
    scope: z.literal("poi"),
    poiId: z.string().min(1),
  })
  .strict();

const CityExecutionFactTargetSchema = z
  .object({
    scope: z.literal("city"),
    city: ExecutionCitySchema,
  })
  .strict();

const NationalExecutionFactTargetSchema = z
  .object({
    scope: z.literal("national"),
    countryCode: z.literal("CN"),
  })
  .strict();

const SceneExecutionFactTargetSchema = z
  .object({
    scope: z.literal("scene"),
    sceneKey: ExecutionMomentSchema,
  })
  .strict();

export const ExecutionFactTargetSchema = z.discriminatedUnion("scope", [
  PoiExecutionFactTargetSchema,
  CityExecutionFactTargetSchema,
  NationalExecutionFactTargetSchema,
  SceneExecutionFactTargetSchema,
]);

// Scoped facts are additive. The legacy POI fact contract remains unchanged and continues to own
// existing POI consumers; this contract reuses its complete provenance and review lifecycle.
export const ScopedExecutionFactSchema = PoiFactSchema.omit({ poiId: true })
  .extend({ target: ExecutionFactTargetSchema })
  .strict();

export const ExecutionFactRetrievalContextSchema = z
  .object({
    poiId: z.string().min(1).optional(),
    city: ExecutionCitySchema.optional(),
    sceneKey: ExecutionMomentSchema.optional(),
    countryCode: z.literal("CN").default("CN"),
  })
  .strict();

export const ExecutionFactVersionResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("current"),
    expectedVersion: z.number().int().positive(),
    currentVersion: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("conflict"),
    expectedVersion: z.number().int().positive(),
    currentVersion: z.number().int().positive().nullable(),
    reason: z.enum(["target_missing", "stale_version"]),
  }),
]);

export type ExecutionMoment = z.infer<typeof ExecutionMomentSchema>;
export type ExecutionFactTarget = z.infer<typeof ExecutionFactTargetSchema>;
export type ScopedExecutionFact = z.infer<typeof ScopedExecutionFactSchema>;
export type ExecutionFactRetrievalContext = z.input<typeof ExecutionFactRetrievalContextSchema>;
export type ExecutionFactVersionResult = z.infer<typeof ExecutionFactVersionResultSchema>;

export function executionFactTargetKey(target: ExecutionFactTarget): string {
  switch (target.scope) {
    case "poi":
      return `poi:${target.poiId}`;
    case "city":
      return `city:${target.city}`;
    case "scene":
      return `scene:${target.sceneKey}`;
    case "national":
      return `national:${target.countryCode}`;
  }
}

export function deriveExecutionFactTargetOrder(
  input: ExecutionFactRetrievalContext,
): ExecutionFactTarget[] {
  const context = ExecutionFactRetrievalContextSchema.parse(input);
  const targets: ExecutionFactTarget[] = [];

  if (context.poiId) targets.push({ scope: "poi", poiId: context.poiId });
  if (context.city) targets.push({ scope: "city", city: context.city });
  if (context.sceneKey) targets.push({ scope: "scene", sceneKey: context.sceneKey });
  targets.push({ scope: "national", countryCode: context.countryCode });

  return targets;
}

export function isEligibleScopedExecutionFact(
  fact: ScopedExecutionFact,
  now = new Date(),
): boolean {
  return isEligibleFactLifecycle(fact, now);
}

export function resolveExecutionFactVersion(input: {
  expectedVersion: number;
  currentVersion: number | null;
}): ExecutionFactVersionResult {
  const expectedVersion = z.number().int().positive().parse(input.expectedVersion);
  const currentVersion = z.number().int().positive().nullable().parse(input.currentVersion);

  if (currentVersion === expectedVersion) {
    return { status: "current", expectedVersion, currentVersion };
  }
  return {
    status: "conflict",
    expectedVersion,
    currentVersion,
    reason: currentVersion === null ? "target_missing" : "stale_version",
  };
}
