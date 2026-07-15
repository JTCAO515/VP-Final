import { HumanTaskSubmissionSchema } from "@visepanda/domain";
import { TRPCError } from "@trpc/server";
import type { RequestIdentity } from "../../context.js";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";
import {
  HumanTaskCapacityError,
  HumanTaskIdempotencyConflictError,
  HumanTaskPreviewScopeError,
  type HumanTaskIdentity,
} from "./service.js";

export const taskRouter = router({
  create: publicProcedure.input(HumanTaskSubmissionSchema).mutation(async ({ ctx, input }) => {
    try {
      const { idempotency_key, ...request } = input;
      return await requireService(ctx.humanTaskService, "Human Task").create({
        identity: requireHumanTaskIdentity(ctx.identity),
        idempotencyKey: idempotency_key,
        request,
      });
    } catch (error) {
      throw mapHumanTaskError(error);
    }
  }),
  listMine: publicProcedure.query(({ ctx }) => {
    return requireService(ctx.humanTaskService, "Human Task").listForOwner(
      requireHumanTaskIdentity(ctx.identity),
    );
  }),
});

function requireHumanTaskIdentity(identity: RequestIdentity | undefined): HumanTaskIdentity {
  if (!identity || identity.kind === "none") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid session is required." });
  }
  return identity;
}

function mapHumanTaskError(error: unknown): TRPCError {
  if (error instanceof HumanTaskCapacityError) {
    return new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message, cause: error });
  }
  if (error instanceof HumanTaskPreviewScopeError) {
    return new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
  }
  if (error instanceof HumanTaskIdempotencyConflictError) {
    return new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
  }
  return error instanceof TRPCError
    ? error
    : new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Human Help request persistence failed.",
        cause: error,
      });
}
