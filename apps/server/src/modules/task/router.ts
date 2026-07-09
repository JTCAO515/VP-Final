import { HumanTaskCreateSchema, HumanTaskUpdateSchema } from "@visepanda/domain";
import { publicProcedure, router } from "../../trpc.js";
import { createInMemoryHumanTaskService } from "./service.js";

export const taskRouter = router({
  create: publicProcedure.input(HumanTaskCreateSchema).mutation(({ ctx, input }) => {
    return (ctx.humanTaskService ?? createInMemoryHumanTaskService()).create(input);
  }),
  list: publicProcedure.query(({ ctx }) => {
    return (ctx.humanTaskService ?? createInMemoryHumanTaskService()).list();
  }),
  update: publicProcedure.input(HumanTaskUpdateSchema).mutation(({ ctx, input }) => {
    return (ctx.humanTaskService ?? createInMemoryHumanTaskService()).update(input);
  }),
});
