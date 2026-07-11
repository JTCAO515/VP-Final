import { HumanTaskCreateSchema, HumanTaskUpdateSchema } from "@visepanda/domain";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";

export const taskRouter = router({
  create: publicProcedure.input(HumanTaskCreateSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.humanTaskService, "Human Task").create(input);
  }),
  list: publicProcedure.query(({ ctx }) => {
    return requireService(ctx.humanTaskService, "Human Task").list();
  }),
  update: publicProcedure.input(HumanTaskUpdateSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.humanTaskService, "Human Task").update(input);
  }),
});
