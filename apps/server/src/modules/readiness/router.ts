import { TRPCError } from "@trpc/server";
import { ChinaReadinessPersistenceRequestSchema } from "@visepanda/domain";
import { z } from "zod";
import type { RequestIdentity } from "../../context.js";
import { requireService } from "../../runtime/requireService.js";
import { publicProcedure, router } from "../../trpc.js";
import type { ReadinessIdentity } from "./service.js";

const LatestReadinessInputSchema = z
  .object({ tripId: z.string().uuid().optional() })
  .strict()
  .optional();

export const readinessRouter = router({
  save: publicProcedure.input(ChinaReadinessPersistenceRequestSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.readinessService, "Readiness").save(
      input,
      requireReadinessIdentity(ctx.identity),
    );
  }),
  latest: publicProcedure.input(LatestReadinessInputSchema).query(({ ctx, input }) => {
    return requireService(ctx.readinessService, "Readiness").latest(
      requireReadinessIdentity(ctx.identity),
      input?.tripId ? { tripId: input.tripId } : undefined,
    );
  }),
});

function requireReadinessIdentity(identity: RequestIdentity | undefined): ReadinessIdentity {
  if (!identity || identity.kind === "none") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid session is required." });
  }
  return identity;
}
