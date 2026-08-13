import { z } from "zod";

import { TripBlockSchema, TripDaySchema, TripStateSchema } from "../trip/index.js";

export const OFFLINE_TRIP_PACKAGE_VERSION = 1 as const;

const OfflineAssetVersionSchema = z.string().trim().min(1).max(80);
const OfflineCitySchema = z.string().trim().min(1).max(100);
const OfflineTripBlockSchema = TripBlockSchema.omit({ metadata: true }).strict();
const OfflineTripDaySchema = TripDaySchema.omit({ blocks: true })
  .extend({ blocks: z.array(OfflineTripBlockSchema).default([]) })
  .strict();
export const OfflineTripSnapshotSchema = TripStateSchema.omit({ days: true })
  .extend({ days: z.array(OfflineTripDaySchema).default([]) })
  .strict();

export const OfflineTripPackageSchema = z
  .object({
    version: z.literal(OFFLINE_TRIP_PACKAGE_VERSION),
    trip: OfflineTripSnapshotSchema,
    toolContentVersion: OfflineAssetVersionSchema,
    phrasePackVersion: OfflineAssetVersionSchema,
    cities: z.array(OfflineCitySchema).max(20),
    savedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .superRefine((tripPackage, context) => {
    if (Date.parse(tripPackage.expiresAt) <= Date.parse(tripPackage.savedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "expiresAt must be after savedAt",
      });
    }
    if (
      new Set(tripPackage.cities.map((city) => city.toLocaleLowerCase())).size !==
      tripPackage.cities.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cities"],
        message: "cities must be unique without case-only duplicates",
      });
    }
    if (containsOfflineCredential(tripPackage)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Offline trip packages must not contain a credential or authorization value",
      });
    }
  });

export type OfflineTripSnapshot = z.infer<typeof OfflineTripSnapshotSchema>;
export type OfflineTripPackage = z.infer<typeof OfflineTripPackageSchema>;

export function createOfflineTripPackage(input: {
  trip: z.input<typeof TripStateSchema>;
  toolContentVersion: string;
  phrasePackVersion: string;
  cities: readonly string[];
  savedAt: Date;
  expiresAt: Date;
}): OfflineTripPackage {
  const trip = TripStateSchema.parse(input.trip);
  const snapshot: OfflineTripSnapshot = {
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      blocks: day.blocks.map(({ metadata: _metadata, ...block }) => block),
    })),
  };

  return OfflineTripPackageSchema.parse({
    version: OFFLINE_TRIP_PACKAGE_VERSION,
    trip: snapshot,
    toolContentVersion: input.toolContentVersion,
    phrasePackVersion: input.phrasePackVersion,
    cities: [...input.cities],
    savedAt: input.savedAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
  });
}

/** Safe for localStorage or AsyncStorage: it contains no token or opaque metadata bag. */
export function serializeOfflineTripPackage(tripPackage: OfflineTripPackage): string {
  return JSON.stringify(OfflineTripPackageSchema.parse(tripPackage));
}

export function deserializeOfflineTripPackage(serialized: string): OfflineTripPackage {
  return OfflineTripPackageSchema.parse(JSON.parse(serialized) as unknown);
}

export function isOfflineTripPackageCurrent(
  tripPackage: OfflineTripPackage,
  now = new Date(),
): boolean {
  return Date.parse(OfflineTripPackageSchema.parse(tripPackage).expiresAt) > now.getTime();
}

function containsOfflineCredential(value: unknown): boolean {
  if (typeof value === "string") {
    return (
      /\b(?:authorization|bearer)\s+[a-z0-9._~+/=-]{12,}/i.test(value) ||
      /\b(?:sk|pk|rk)_[a-z0-9_-]{12,}\b/i.test(value) ||
      /\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/i.test(value)
    );
  }
  if (Array.isArray(value)) return value.some(containsOfflineCredential);
  if (value && typeof value === "object")
    return Object.values(value).some(containsOfflineCredential);
  return false;
}
