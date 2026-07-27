import { TripBlockSchema, TripPatchSchema, type TripBlock, type TripDay } from "@visepanda/domain";
import type { CompletionJobService } from "./completionJobService.js";
import type { CompletionDelivery, CompletionQueue } from "./completionQueue.js";
import type { TelemetryService } from "../telemetry/service.js";
import { recordTelemetrySafely } from "../telemetry/producer.js";
import {
  TripVersionConflictError,
  type TripIdentity,
  type VersionedTripService,
} from "../trip/versionedService.js";

export type CompleteDay = (
  day: TripDay,
  context: { jobId: string; attempt: number; tripId: string; identity: TripIdentity },
) => Promise<TripBlock>;

export type CompletionProcessResult = {
  accepted: boolean;
  state: "duplicate" | "completed" | "queued" | "failed" | "conflicted";
};

export function createCompletionProcessor({
  completeDay,
  jobService,
  queue,
  telemetryService,
  tripService,
}: {
  completeDay: CompleteDay;
  jobService: CompletionJobService;
  queue: CompletionQueue;
  telemetryService?: TelemetryService;
  tripService: VersionedTripService;
}) {
  return {
    async process(payload: CompletionDelivery): Promise<CompletionProcessResult> {
      const claimed = await jobService.claim(payload.jobId, payload.idempotencyKey);
      if (!claimed) return { accepted: false, state: "duplicate" };
      const { identity, job } = claimed;
      const snapshot = await tripService.get(job.tripId, identity);
      const events = await tripService.getEvents(job.tripId, identity);
      if (!snapshot || !events) {
        await jobService.settle(job.id, job.attempt, "failed", "trip_missing");
        return { accepted: true, state: "failed" };
      }

      const latestCompletionEvent = events
        .filter((event) => event.completion?.jobId === job.id)
        .at(-1);
      const expectedVersion = latestCompletionEvent?.version ?? job.baseVersion;
      if (snapshot.version !== expectedVersion) {
        await jobService.settle(job.id, job.attempt, "conflicted", "trip_version_conflict");
        return { accepted: true, state: "conflicted" };
      }

      const emptyDays = snapshot.trip.days.filter((day) => day.blocks.length === 0);
      if (emptyDays.length === 0) {
        await jobService.settle(job.id, job.attempt, "completed");
        recordCompletionTelemetry(telemetryService, identity, job.tripId, false);
        return { accepted: true, state: "completed" };
      }
      if (latestCompletionEvent?.completion?.attempt === job.attempt) {
        await jobService.settle(job.id, job.attempt, "partial", "partial_completion");
        return { accepted: true, state: "failed" };
      }

      const operations = [];
      let failedDays = 0;
      for (const day of emptyDays) {
        try {
          const block = TripBlockSchema.parse(
            await completeDay(day, {
              jobId: job.id,
              attempt: job.attempt,
              tripId: job.tripId,
              identity,
            }),
          );
          operations.push({ op: "upsert_block" as const, dayId: day.id, block });
        } catch {
          failedDays += 1;
        }
      }

      if (operations.length > 0) {
        try {
          const updated = await tripService.apply({
            id: job.tripId,
            identity,
            expectedVersion,
            patch: TripPatchSchema.parse({ operations }),
            source: "ai_copilot",
            completion: { jobId: job.id, attempt: job.attempt },
          });
          if (!updated) return retryOrFail(job, "trip_missing");
        } catch (error) {
          if (error instanceof TripVersionConflictError || isUniqueViolation(error)) {
            await jobService.settle(job.id, job.attempt, "conflicted", "trip_version_conflict");
            return { accepted: true, state: "conflicted" };
          }
          return retryOrFail(job, "trip_apply_failed");
        }
      }

      if (failedDays === 0) {
        await jobService.settle(job.id, job.attempt, "completed");
        recordCompletionTelemetry(telemetryService, identity, job.tripId, operations.length > 0);
        return { accepted: true, state: "completed" };
      }
      return retryOrFail(job, operations.length > 0 ? "partial_completion" : "provider_failed");

      async function retryOrFail(
        currentJob: typeof job,
        errorCode: string,
      ): Promise<CompletionProcessResult> {
        const state = operations.length > 0 ? "partial" : "failed";
        await jobService.settle(currentJob.id, currentJob.attempt, state, errorCode);
        if (currentJob.attempt >= currentJob.maxAttempts) {
          return { accepted: true, state: "failed" };
        }
        const queued = await jobService.requeue(currentJob.id, currentJob.attempt);
        if (!queued) return { accepted: true, state: "failed" };
        await queue.publish(payload, currentJob.attempt + 1);
        return { accepted: true, state: "queued" };
      }
    },
  };
}

function recordCompletionTelemetry(
  telemetryService: TelemetryService | undefined,
  identity: TripIdentity,
  tripId: string,
  patchApplied: boolean,
): void {
  const base = {
    ...(identity.kind === "authenticated"
      ? { user_id: identity.userId }
      : { anon_id: identity.anonId }),
    surface: "server" as const,
    entity_type: "trip",
    entity_id: tripId,
    props_jsonb: {},
  };
  if (patchApplied) {
    recordTelemetrySafely(
      telemetryService,
      { ...base, action: "patch_applied" },
      "completion_telemetry_write_failed",
    );
  }
  recordTelemetrySafely(
    telemetryService,
    { ...base, action: "details_completed" },
    "completion_telemetry_write_failed",
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    error.cause.code === "23505"
  );
}
