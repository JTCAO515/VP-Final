import { publicProcedure, router } from "../../trpc.js";
import { CopilotRunInputSchema, createCopilotPipeline } from "./service.js";
import { CompleteTripInputSchema, createTwoPassWorker } from "./twoPassWorker.js";

export const copilotRouter = router({
  completeTrip: publicProcedure.input(CompleteTripInputSchema).mutation(({ ctx, input }) => {
    return createTwoPassWorker({ tripService: ctx.tripService }).completeTrip(input);
  }),
  run: publicProcedure.input(CopilotRunInputSchema).mutation(({ ctx, input }) => {
    return createCopilotPipeline({
      ...(ctx.knowledgeService ? { knowledgeService: ctx.knowledgeService } : {}),
      tripService: ctx.tripService,
    }).run(input);
  }),
});
