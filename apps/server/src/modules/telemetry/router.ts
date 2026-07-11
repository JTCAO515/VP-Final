import { TelemetryEventSchema } from "@visepanda/domain";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";

const TelemetryInputSchema = TelemetryEventSchema.omit({ id: true, created_at: true }).extend({
  id: TelemetryEventSchema.shape.id.optional(),
  created_at: TelemetryEventSchema.shape.created_at.optional(),
});

export const telemetryRouter = router({
  track: publicProcedure.input(TelemetryInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.telemetryService, "Telemetry").track(input);
  }),
});
