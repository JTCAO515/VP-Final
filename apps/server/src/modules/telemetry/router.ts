import { TRPCError } from "@trpc/server";
import { TelemetryCaptureInputSchema } from "@visepanda/domain";
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
});

function trustedTelemetryIdentity(identity: RequestIdentity | undefined) {
  if (identity?.kind === "authenticated") return { user_id: identity.userId };
  if (identity?.kind === "anonymous") return { anon_id: identity.anonId };
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "A trusted VisePanda session is required for telemetry.",
  });
}
