import { CompletionJobRetryInputSchema } from "@visepanda/domain";
import { z } from "zod";
import type { ServerContext } from "../../context.js";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";
import { CopilotRunInputSchema, createCopilotPipeline } from "./service.js";
import { CompleteTripInputSchema } from "./twoPassWorker.js";
import { requireTripIdentity } from "../trip/router.js";
import {
  AnonymousTurnCapacityReservedError,
  AnonymousTurnControlUnavailableError,
  AnonymousTurnLimitExceededError,
} from "./anonymousTurnCounter.js";

export const copilotRouter = router({
  completeTrip: publicProcedure.input(CompleteTripInputSchema).mutation(async ({ ctx, input }) => {
    const jobs = requireService(ctx.completionJobService, "Durable Trip completion");
    const queue = requireService(ctx.completionQueue, "Durable Trip completion queue");
    const job = await jobs.create(
      {
        tripId: input.tripId,
        baseVersion: input.expectedVersion,
        idempotencyKey: crypto.randomUUID(),
        maxAttempts: 2,
      },
      requireTripIdentity(ctx.identity),
    );
    if (job.state === "queued" && job.attempt < job.maxAttempts) {
      await queue.publish(
        { jobId: job.id, idempotencyKey: job.idempotencyKey },
        Math.max(1, job.attempt + 1),
      );
    }
    return job;
  }),
  completionStatus: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => {
      return requireService(ctx.completionJobService, "Durable Trip completion").get(
        input.id,
        requireTripIdentity(ctx.identity),
      );
    }),
  retryCompletion: publicProcedure
    .input(CompletionJobRetryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const jobs = requireService(ctx.completionJobService, "Durable Trip completion");
      const queue = requireService(ctx.completionQueue, "Durable Trip completion queue");
      const job = await jobs.retry(
        input.id,
        input.idempotencyKey,
        requireTripIdentity(ctx.identity),
      );
      if (!job) return null;
      await queue.publish(
        { jobId: job.id, idempotencyKey: job.idempotencyKey },
        Math.max(1, job.attempt + 1),
      );
      return job;
    }),
  run: publicProcedure.input(CopilotRunInputSchema).mutation(async ({ ctx, input }) => {
    const identity = requireTripIdentity(ctx.identity);
    const reservation =
      identity.kind === "anonymous"
        ? await reserveAnonymousTurn(ctx.anonymousTurnCounter, identity.anonId)
        : null;
    try {
      const result = await createCopilotPipeline({
        ...(ctx.knowledgeService ? { knowledgeService: ctx.knowledgeService } : {}),
        ...(ctx.traceService ? { traceService: ctx.traceService } : {}),
        ...(ctx.copilotModelDependencies ?? {}),
        ...(ctx.demoDialogueOnly ? { demoDialogueOnly: true } : {}),
        tripService: ctx.tripService,
      }).run(input, identity);
      const anonymousUsage = reservation ? await reservation.complete() : null;
      return { ...result, anonymousUsage };
    } catch (error) {
      if (reservation) await releaseReservationSafely(reservation);
      throw error;
    }
  }),
});

async function reserveAnonymousTurn(
  counter: ServerContext["anonymousTurnCounter"],
  anonId: string,
) {
  if (!counter) throw new AnonymousTurnControlUnavailableError("counter_not_configured");
  const admission = await counter.reserve(anonId);
  if (!admission.allowed) {
    if (admission.reason === "capacity_reserved") {
      throw new AnonymousTurnCapacityReservedError(admission.usage);
    }
    throw new AnonymousTurnLimitExceededError(admission.usage);
  }
  return admission;
}

async function releaseReservationSafely(
  reservation: Awaited<ReturnType<typeof reserveAnonymousTurn>>,
): Promise<void> {
  try {
    await reservation.release();
  } catch {
    console.warn("anonymous_turn_reservation_release_failed");
  }
}
