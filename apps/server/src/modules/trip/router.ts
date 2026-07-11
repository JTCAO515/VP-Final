import { TRPCError } from "@trpc/server";
import { TripPatchSchema, TripStateSchema } from "@visepanda/domain";
import { z } from "zod";
import type { RequestIdentity } from "../../context.js";
import { publicProcedure, router } from "../../trpc.js";
import {
  TripVersionConflictError,
  type ClaimIdentity,
  type TripIdentity,
} from "./versionedService.js";

const TripIdSchema = z.object({ id: z.string().min(1) });
const ApplyInputSchema = TripIdSchema.extend({
  expectedVersion: z.number().int().nonnegative(),
  patch: TripPatchSchema,
});
const SharedLookupSchema = z.object({ token: z.string().min(1) });

export const tripRouter = router({
  applyPatch: publicProcedure.input(ApplyInputSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.tripService.apply({
        ...input,
        identity: requireTripIdentity(ctx.identity),
        source: "user_manual",
      });
    } catch (error) {
      throw mapTripError(error);
    }
  }),
  claimAnonymous: publicProcedure.mutation(({ ctx }) => {
    return ctx.tripService.claim(requireClaimIdentity(ctx.identity));
  }),
  create: publicProcedure.input(TripStateSchema).mutation(({ ctx, input }) => {
    return ctx.tripService.create(input, requireTripIdentity(ctx.identity), "user_manual");
  }),
  get: publicProcedure.input(TripIdSchema).query(({ ctx, input }) => {
    return ctx.tripService.get(input.id, requireTripIdentity(ctx.identity));
  }),
  list: publicProcedure.query(({ ctx }) => {
    return ctx.tripService.list(requireTripIdentity(ctx.identity));
  }),
  createShareToken: publicProcedure.input(TripIdSchema).mutation(({ ctx, input }) => {
    return ctx.tripService.createShareToken(input.id, requireTripIdentity(ctx.identity));
  }),
  revokeShareToken: publicProcedure.input(TripIdSchema).mutation(({ ctx, input }) => {
    return ctx.tripService.revokeShareToken(input.id, requireTripIdentity(ctx.identity));
  }),
  shared: publicProcedure.input(SharedLookupSchema).query(({ ctx, input }) => {
    return ctx.tripService.getByShareToken(input.token);
  }),
});

export function requireTripIdentity(identity: RequestIdentity | undefined): TripIdentity {
  if (!identity || identity.kind === "none") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid session is required." });
  }
  return identity;
}

export function requireClaimIdentity(identity: RequestIdentity | undefined): ClaimIdentity {
  if (identity?.kind !== "authenticated" || !identity.anonId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "A signed-in claim session is required.",
    });
  }
  return { ...identity, anonId: identity.anonId };
}

function mapTripError(error: unknown): TRPCError {
  if (error instanceof TripVersionConflictError) {
    return new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
  }
  return error instanceof TRPCError
    ? error
    : new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Trip update failed.",
        cause: error,
      });
}
