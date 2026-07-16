import {
  GenerationProgressSchema,
  type GenerationProgress,
  type TripBlock,
  type TripDay,
  type TripPatch,
} from "@visepanda/domain";
import { z } from "zod";
import type { TripIdentity, VersionedTripService } from "../trip/versionedService.js";

export const CompleteTripInputSchema = z.object({
  tripId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  maxAttemptsPerDay: z.number().int().positive().default(2),
});

export type CompleteTripInput = z.input<typeof CompleteTripInputSchema>;

type CompleteDay = (day: TripDay) => Promise<TripBlock>;

export function createTwoPassWorker({
  tripService,
  completeDay,
}: {
  tripService: VersionedTripService;
  completeDay: CompleteDay;
}) {
  return {
    async completeTrip(
      input: CompleteTripInput,
      identity: TripIdentity,
    ): Promise<GenerationProgress> {
      const parsed = CompleteTripInputSchema.parse(input);
      const snapshot = await tripService.get(parsed.tripId, identity);
      if (!snapshot) throw new Error(`Trip not found: ${parsed.tripId}`);
      const trip = snapshot.trip;

      const appliedOperations: TripPatch["operations"] = [];
      const emptyDays = trip.days.filter((day) => day.blocks.length === 0);
      let progress = GenerationProgressSchema.parse({
        status: emptyDays.length === 0 ? "completed" : "completing",
        totalDays: emptyDays.length,
      });

      for (const day of emptyDays) {
        let lastError: unknown;

        for (let attempt = 1; attempt <= parsed.maxAttemptsPerDay; attempt += 1) {
          progress = { ...progress, attempts: progress.attempts + 1 };

          try {
            const block = await completeDay(day);
            const patch: TripPatch = {
              operations: [{ op: "upsert_block", dayId: day.id, block }],
            };
            appliedOperations.push(...patch.operations);
            progress = { ...progress, completedDays: progress.completedDays + 1 };
            break;
          } catch (error) {
            lastError = error;
            if (attempt === parsed.maxAttemptsPerDay) {
              return GenerationProgressSchema.parse({
                ...progress,
                status: "failed",
                error: error instanceof Error ? error.message : String(lastError),
              });
            }
          }
        }
      }

      await tripService.apply({
        id: parsed.tripId,
        identity,
        expectedVersion: parsed.expectedVersion,
        patch: { operations: appliedOperations },
        source: "ai_copilot",
      });
      return GenerationProgressSchema.parse({ ...progress, status: "completed" });
    },
  };
}
