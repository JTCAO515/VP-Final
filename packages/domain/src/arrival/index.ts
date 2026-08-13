import { z } from "zod";
import {
  CHINA_READINESS_ASSESSMENT_VERSION,
  ChinaReadinessResultSchema,
} from "../readiness/index.js";
import { TOOLS_CONTENT_PACK_VERSION } from "../tools/index.js";
import { TripStateSchema } from "../trip/index.js";

export const ARRIVAL_PACK_VERSION = 1 as const;

const ArrivalPackTextSchema = z.string().trim().min(1).max(240);
const ArrivalPackTimeSchema = z.string().trim().min(1).max(40);

export const ArrivalPackBlockSchema = z
  .object({
    title: ArrivalPackTextSchema,
    startTime: ArrivalPackTimeSchema.nullable(),
    endTime: ArrivalPackTimeSchema.nullable(),
    status: z.enum(["planned", "ready", "needs_attention", "done"]).nullable(),
  })
  .strict();

export const ArrivalPackFirstDaySchema = z
  .object({
    dayNumber: z.number().int().positive().nullable(),
    date: z.string().trim().min(1).max(40).nullable(),
    city: z.string().trim().min(1).max(100).nullable(),
    title: ArrivalPackTextSchema.nullable(),
    blocks: z.array(ArrivalPackBlockSchema).max(50),
  })
  .strict();

/** A local address is eligible only with an independently reviewed POI fact receipt. */
export const ArrivalPackVerifiedAddressSchema = z
  .object({
    label: ArrivalPackTextSchema,
    localAddressZh: ArrivalPackTextSchema,
    sourceFactId: z.string().uuid(),
    verifiedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const ArrivalPackReadinessSchema = z
  .object({
    version: z.literal(CHINA_READINESS_ASSESSMENT_VERSION),
    savedAt: z.string().datetime(),
    result: ChinaReadinessResultSchema,
  })
  .strict();

export const ArrivalPackContentVersionsSchema = z
  .object({
    tools: z.literal(TOOLS_CONTENT_PACK_VERSION),
    phrasePack: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();

export const ArrivalPackSchema = z
  .object({
    version: z.literal(ARRIVAL_PACK_VERSION),
    tripId: z.string().min(1).max(120),
    tripVersion: z.number().int().nonnegative(),
    tripTitle: ArrivalPackTextSchema,
    generatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    contentVersions: ArrivalPackContentVersionsSchema,
    firstDay: ArrivalPackFirstDaySchema,
    verifiedAddresses: z.array(ArrivalPackVerifiedAddressSchema).max(20),
    readiness: ArrivalPackReadinessSchema.nullable(),
  })
  .strict()
  .superRefine((pack, context) => {
    if (Date.parse(pack.expiresAt) <= Date.parse(pack.generatedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Arrival Pack expiry must be after generation",
      });
    }
    for (const [index, address] of pack.verifiedAddresses.entries()) {
      if (Date.parse(address.verifiedAt) > Date.parse(pack.generatedAt)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["verifiedAddresses", index, "verifiedAt"],
          message: "Arrival Pack addresses cannot be verified after generation",
        });
      }
      if (Date.parse(address.expiresAt) <= Date.parse(pack.generatedAt)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["verifiedAddresses", index, "expiresAt"],
          message: "Arrival Pack addresses must still be current when generated",
        });
      }
    }
  });

export type ArrivalPack = z.infer<typeof ArrivalPackSchema>;
export type ArrivalPackFirstDay = z.infer<typeof ArrivalPackFirstDaySchema>;
export type ArrivalPackVerifiedAddress = z.infer<typeof ArrivalPackVerifiedAddressSchema>;

/**
 * Projects only the deliberately portable arrival fields. It never copies block descriptions,
 * notes, addresses, metadata, raw conversation, or credentials into an Arrival Pack.
 */
export function createArrivalPack(input: {
  trip: z.input<typeof TripStateSchema>;
  tripVersion: number;
  generatedAt: Date;
  expiresAt: Date;
  verifiedAddresses?: readonly z.input<typeof ArrivalPackVerifiedAddressSchema>[];
  readiness?: z.input<typeof ArrivalPackReadinessSchema> | null;
  phrasePackVersion?: string | null;
}): ArrivalPack {
  const trip = TripStateSchema.parse(input.trip);
  const firstDay = trip.days[0];

  return ArrivalPackSchema.parse({
    version: ARRIVAL_PACK_VERSION,
    tripId: trip.id,
    tripVersion: input.tripVersion,
    tripTitle: trip.title,
    generatedAt: input.generatedAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    contentVersions: {
      tools: TOOLS_CONTENT_PACK_VERSION,
      phrasePack: input.phrasePackVersion ?? null,
    },
    firstDay: firstDay
      ? {
          dayNumber: firstDay.dayNumber,
          date: firstDay.date ?? null,
          city: firstDay.city ?? null,
          title: firstDay.title ?? null,
          blocks: firstDay.blocks.map((block) => ({
            title: block.title,
            startTime: block.startTime ?? null,
            endTime: block.endTime ?? null,
            status: block.status ?? null,
          })),
        }
      : { dayNumber: null, date: null, city: null, title: null, blocks: [] },
    verifiedAddresses: input.verifiedAddresses ?? [],
    readiness: input.readiness ?? null,
  });
}
