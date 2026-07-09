import { TripStateSchema } from "@visepanda/domain";
import { z } from "zod";
import { publicProcedure, router } from "../../trpc.js";

const TripGetInputSchema = TripStateSchema.pick({ id: true });
const TripOwnerInputSchema = z.object({
  userId: z.string().uuid().optional(),
  anonId: z.string().min(1).optional(),
  email: z.string().email().optional(),
});
const TripCreateInputSchema = z.union([
  TripStateSchema,
  z.object({
    trip: TripStateSchema,
    owner: TripOwnerInputSchema.optional(),
  }),
]);
const TripGetWithOwnerInputSchema = TripGetInputSchema.merge(TripOwnerInputSchema);
const TripClaimInputSchema = z.object({
  anonId: z.string().min(1),
  userId: z.string().uuid(),
  email: z.string().email().optional(),
});

export const tripRouter = router({
  claimAnonymous: publicProcedure.input(TripClaimInputSchema).mutation(({ ctx, input }) => {
    return ctx.tripService.claimAnonymousTrips(input);
  }),
  create: publicProcedure.input(TripCreateInputSchema).mutation(({ ctx, input }) => {
    if ("trip" in input) return ctx.tripService.create(input.trip, { owner: input.owner });
    return ctx.tripService.create(input);
  }),
  get: publicProcedure.input(TripGetWithOwnerInputSchema).query(({ ctx, input }) => {
    return ctx.tripService.get(input.id, input);
  }),
  list: publicProcedure.input(TripOwnerInputSchema).query(({ ctx, input }) => {
    return ctx.tripService.list(input);
  }),
});
