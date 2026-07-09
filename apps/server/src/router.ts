import { router } from "./trpc.js";
import { copilotRouter } from "./modules/copilot/router.js";
import { knowledgeRouter } from "./modules/knowledge/router.js";
import { taskRouter } from "./modules/task/router.js";
import { telemetryRouter } from "./modules/telemetry/router.js";
import { tripRouter } from "./modules/trip/router.js";

export const appRouter = router({
  copilot: copilotRouter,
  knowledge: knowledgeRouter,
  task: taskRouter,
  telemetry: telemetryRouter,
  trip: tripRouter,
});

export type AppRouter = typeof appRouter;
