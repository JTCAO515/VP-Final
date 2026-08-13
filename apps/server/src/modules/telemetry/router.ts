import { TRPCError } from "@trpc/server";
import { MobileTelemetryCaptureInputSchema, TelemetryCaptureInputSchema } from "@visepanda/domain";
import type { RequestIdentity } from "../../context.js";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";

export const telemetryRouter = router({
  track: publicProcedure.input(TelemetryCaptureInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.telemetryService, "Telemetry").track({
      ...trustedTelemetryIdentity(ctx.identity),
      surface: "web",
      ...input,
    });
  }),
  trackMobile: publicProcedure
    .input(MobileTelemetryCaptureInputSchema)
    .mutation(({ ctx, input }) => {
      const identity = ctx.identity;
      if (identity?.kind !== "authenticated") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "A verified VisePanda account is required for mobile telemetry.",
        });
      }
      return requireService(ctx.telemetryService, "Telemetry").track({
        id: input.id,
        user_id: identity.userId,
        surface: "mobile",
        action: input.action,
        entity_type: input.entity_type,
        ...(input.entity_id ? { entity_id: input.entity_id } : {}),
        props_jsonb: input.props_jsonb,
      });
    }),
});

function trustedTelemetryIdentity(identity: RequestIdentity | undefined) {
  if (identity?.kind === "authenticated") return { user_id: identity.userId };
  if (identity?.kind === "anonymous") return { anon_id: identity.anonId };
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "A trusted VisePanda session is required for telemetry.",
  });
}
