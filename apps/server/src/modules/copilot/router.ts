import { publicProcedure, router } from "../../trpc.js";
import { CopilotRunInputSchema, createCopilotPipeline } from "./service.js";

export const copilotRouter = router({
  run: publicProcedure.input(CopilotRunInputSchema).mutation(({ ctx, input }) => {
    return createCopilotPipeline({ tripService: ctx.tripService }).run(input);
  }),
});
