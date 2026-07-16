import { CompletionJobRetryInputSchema } from "@visepanda/domain";
import { z } from "zod";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";
import { CopilotRunInputSchema, createCopilotPipeline } from "./service.js";
import { CompleteTripInputSchema } from "./twoPassWorker.js";
import { requireTripIdentity } from "../trip/router.js";

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
  run: publicProcedure.input(CopilotRunInputSchema).mutation(({ ctx, input }) => {
    return createCopilotPipeline({
      ...(ctx.knowledgeService ? { knowledgeService: ctx.knowledgeService } : {}),
      ...(ctx.traceService ? { traceService: ctx.traceService } : {}),
      ...(ctx.copilotModelDependencies ?? {}),
      ...(ctx.demoDialogueOnly ? { demoDialogueOnly: true } : {}),
      tripService: ctx.tripService,
    }).run(input, requireTripIdentity(ctx.identity));
  }),
});
