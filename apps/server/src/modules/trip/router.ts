import { TripStateSchema } from "@visepanda/domain";
import { publicProcedure, router } from "../../trpc.js";

const TripGetInputSchema = TripStateSchema.pick({ id: true });

export const tripRouter = router({
  create: publicProcedure.input(TripStateSchema).mutation(({ ctx, input }) => {
    return ctx.tripService.create(input);
  }),
  get: publicProcedure.input(TripGetInputSchema).query(({ ctx, input }) => {
    return ctx.tripService.get(input.id);
  }),
});
