import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { RequestIdentity } from "../../context.js";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";
import {
  InvalidOutboundTargetError,
  PartnerUnavailableError,
  type OutboundIdentity,
} from "./service.js";

const SafeLedgerLabelSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Outbound metadata must be an identifier");

export const OutboundRedirectInputSchema = z.object({
  partnerKey: SafeLedgerLabelSchema.max(64),
  targetUrl: z.string().trim().min(1).max(2_048),
  source: SafeLedgerLabelSchema.max(64).optional(),
  intent: SafeLedgerLabelSchema.max(64).optional(),
  entityId: SafeLedgerLabelSchema.max(128).optional(),
});

export const commerceRouter = router({
  createOutboundRedirect: publicProcedure
    .input(OutboundRedirectInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await requireService(
          ctx.commerceService,
          "Outbound commerce",
        ).createOutboundRedirect({
          identity: requireOutboundIdentity(ctx.identity),
          partnerKey: input.partnerKey,
          targetUrl: input.targetUrl,
          ...(input.source ? { source: input.source } : {}),
          ...(input.intent ? { intent: input.intent } : {}),
          ...(input.entityId ? { entityId: input.entityId } : {}),
        });
      } catch (error) {
        throw mapCommerceError(error);
      }
    }),
});

function requireOutboundIdentity(identity: RequestIdentity | undefined): OutboundIdentity {
  if (!identity || identity.kind === "none") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "A valid session is required." });
  }
  return identity;
}

function mapCommerceError(error: unknown): TRPCError {
  if (error instanceof PartnerUnavailableError) {
    return new TRPCError({ code: "NOT_FOUND", message: error.message, cause: error });
  }
  if (error instanceof InvalidOutboundTargetError) {
    return new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
  }
  return error instanceof TRPCError
    ? error
    : new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "The partner redirect could not be recorded.",
        cause: error,
      });
}
