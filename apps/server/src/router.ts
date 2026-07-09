import { router } from "./trpc.js";
import { tripRouter } from "./modules/trip/router.js";

export const appRouter = router({
  trip: tripRouter,
});

export type AppRouter = typeof appRouter;
