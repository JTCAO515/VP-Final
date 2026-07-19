import {
  GenerationProgressSchema,
  type CompletionJob,
  type GenerationProgress,
  type TripState,
} from "@visepanda/domain";
import { z } from "zod";

export const COMPLETION_REFERENCE_KEY = "visepanda.completionJob";
export const COMPLETION_POLL_INTERVAL_MS = 1_500;
export const COMPLETION_MAX_POLLS = 40;

const CompletionReferenceSchema = z
  .object({
    id: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
    tripId: z.string().uuid(),
  })
  .strict();

export type CompletionReference = z.infer<typeof CompletionReferenceSchema>;

export function completionReference(job: CompletionJob): CompletionReference {
  return CompletionReferenceSchema.parse({
    id: job.id,
    idempotencyKey: job.idempotencyKey,
    tripId: job.tripId,
  });
}

export function readCompletionReference(
  storage: Pick<Storage, "getItem">,
): CompletionReference | null {
  const value = storage.getItem(COMPLETION_REFERENCE_KEY);
  if (!value) return null;
  try {
    return CompletionReferenceSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

export function writeCompletionReference(
  storage: Pick<Storage, "setItem">,
  reference: CompletionReference,
): void {
  storage.setItem(COMPLETION_REFERENCE_KEY, JSON.stringify(reference));
}

export function clearCompletionReference(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(COMPLETION_REFERENCE_KEY);
}

export function completionProgress(job: CompletionJob, trip: TripState | null): GenerationProgress {
  const totalDays = trip?.days.length ?? 0;
  const completedDays = trip?.days.filter((day) => day.blocks.length > 0).length ?? 0;
  return GenerationProgressSchema.parse({
    status:
      job.state === "queued" || job.state === "running"
        ? "completing"
        : job.state === "completed"
          ? "completed"
          : "failed",
    completedDays,
    totalDays,
    attempts: job.attempt,
    error: completionError(job),
  });
}

export function canRetryCompletion(job: CompletionJob): boolean {
  return (job.state === "partial" || job.state === "failed") && job.attempt < job.maxAttempts;
}

export function completionStateCopy(job: CompletionJob): {
  title: string;
  detail: string;
} {
  switch (job.state) {
    case "queued":
      return { title: "Trip details queued", detail: "The detail pass will begin shortly." };
    case "running":
      return { title: "Filling trip details", detail: "Your trip skeleton is already available." };
    case "completed":
      return {
        title: "Trip details complete",
        detail: "The saved trip now has its latest details.",
      };
    case "partial":
      return {
        title: "Some details still need work",
        detail: "The completed parts are saved. You can retry the remaining detail pass.",
      };
    case "failed":
      return {
        title: "Detail pass stopped",
        detail: "Your trip skeleton is safe. Retry is available when the server allows it.",
      };
    case "conflicted":
      return {
        title: "Trip changed before completion",
        detail: "Reloaded the latest saved trip. No older details were written over it.",
      };
  }
}

function completionError(job: CompletionJob): string | null {
  if (job.state === "partial") return "Some trip details could not be completed.";
  if (job.state === "failed") return "Trip detail completion stopped.";
  if (job.state === "conflicted") return "The trip changed before completion could finish.";
  return null;
}
