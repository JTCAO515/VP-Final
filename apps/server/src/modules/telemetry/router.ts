import { TelemetryEventInputSchema } from "@visepanda/domain";
import { publicProcedure, router } from "../../trpc.js";
import { requireService } from "../../runtime/requireService.js";

export const telemetryRouter = router({
  track: publicProcedure.input(TelemetryEventInputSchema).mutation(({ ctx, input }) => {
    return requireService(ctx.telemetryService, "Telemetry").track(input);
  }),
});
