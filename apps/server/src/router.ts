import { router } from "./trpc.js";
import { copilotRouter } from "./modules/copilot/router.js";
import { tripRouter } from "./modules/trip/router.js";

export const appRouter = router({
  copilot: copilotRouter,
  trip: tripRouter,
});

export type AppRouter = typeof appRouter;
