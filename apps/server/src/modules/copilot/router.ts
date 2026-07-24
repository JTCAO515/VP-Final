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
import { opaqueCopilotSessionId } from "../observability/copilotPersistence.js";
import type { CopilotProductEventService } from "../trace/service.js";
import type { TripIdentity } from "../trip/versionedService.js";

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
        ? await reserveAnonymousTurn(ctx.anonymousTurnCounter, ctx.productEventService, identity)
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
  productEventService: CopilotProductEventService | undefined,
  identity: Extract<TripIdentity, { kind: "anonymous" }>,
) {
  if (!counter) throw new AnonymousTurnControlUnavailableError("counter_not_configured");
  const admission = await counter.reserve(identity.anonId);
  if (!admission.allowed) {
    if (admission.reason === "capacity_reserved") {
      throw new AnonymousTurnCapacityReservedError(admission.usage);
    }
    const sessionId = opaqueCopilotSessionId(identity);
    await recordProductEventSafely(productEventService, {
      identity,
      action: "anon_limit_hit",
      entityType: "copilot_session",
      entityId: sessionId,
      props: { limit: admission.usage.limit },
    });
    await recordProductEventSafely(productEventService, {
      identity,
      action: "register_prompt_shown",
      entityType: "copilot_session",
      entityId: sessionId,
      props: { reason: "anonymous_turn_limit" },
    });
    throw new AnonymousTurnLimitExceededError(admission.usage);
  }
  return admission;
}

async function recordProductEventSafely(
  service: CopilotProductEventService | undefined,
  input: Parameters<CopilotProductEventService["recordProductEvent"]>[0],
): Promise<void> {
  if (!service) return;
  try {
    await service.recordProductEvent(input);
  } catch {
    console.warn("copilot_observability_write_failed", {
      failureClass: "persistence_error",
    });
  }
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
