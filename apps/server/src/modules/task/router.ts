import { HumanTaskSubmissionSchema } from "@visepanda/domain";
import { TRPCError } from "@trpc/server";
import type { RequestIdentity } from "../../context.js";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";
import { recordTelemetrySafely } from "../telemetry/producer.js";
import {
  HumanTaskCapacityError,
  HumanTaskIdentityCapacityError,
  HumanTaskIdempotencyConflictError,
  HumanTaskPreviewScopeError,
  type HumanTaskIdentity,
} from "./service.js";

export const taskRouter = router({
  create: publicProcedure.input(HumanTaskSubmissionSchema).mutation(async ({ ctx, input }) => {
    try {
      const { idempotency_key, ...request } = input;
      const identity = requireHumanTaskIdentity(ctx.identity);
      const task = await requireService(ctx.humanTaskService, "Human Task").create({
        identity,
        idempotencyKey: idempotency_key,
        request,
      });
      recordTelemetrySafely(
        ctx.telemetryService,
        {
          ...telemetryIdentity(identity),
          surface: "server",
          action: "task_submitted",
          entity_type: "human_task",
          entity_id: task.id,
          props_jsonb: { city: task.city, kind: task.kind },
        },
        "human_task_telemetry_write_failed",
      );
      return task;
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

function telemetryIdentity(identity: HumanTaskIdentity): { user_id?: string; anon_id?: string } {
  return identity.kind === "authenticated"
    ? { user_id: identity.userId }
    : { anon_id: identity.anonId };
}

function mapHumanTaskError(error: unknown): TRPCError {
  if (error instanceof HumanTaskCapacityError || error instanceof HumanTaskIdentityCapacityError) {
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
