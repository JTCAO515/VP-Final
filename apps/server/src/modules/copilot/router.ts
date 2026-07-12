import { publicProcedure, router } from "../../trpc.js";
import { CopilotRunInputSchema, createCopilotPipeline } from "./service.js";
import { CompleteTripInputSchema, createTwoPassWorker } from "./twoPassWorker.js";
import { requireTripIdentity } from "../trip/router.js";

export const copilotRouter = router({
  completeTrip: publicProcedure.input(CompleteTripInputSchema).mutation(({ ctx, input }) => {
    return createTwoPassWorker({ tripService: ctx.tripService }).completeTrip(
      input,
      requireTripIdentity(ctx.identity),
    );
  }),
  run: publicProcedure.input(CopilotRunInputSchema).mutation(({ ctx, input }) => {
    return createCopilotPipeline({
      ...(ctx.knowledgeService ? { knowledgeService: ctx.knowledgeService } : {}),
      ...(ctx.traceService ? { traceService: ctx.traceService } : {}),
      tripService: ctx.tripService,
    }).run(input, requireTripIdentity(ctx.identity));
  }),
});
