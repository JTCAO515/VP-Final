import type { TripService } from "./modules/trip/service.js";
import type { KnowledgeService } from "./modules/knowledge/service.js";
import type { TelemetryService } from "./modules/telemetry/service.js";
import type { HumanTaskService } from "./modules/task/service.js";

export type ServerContext = {
  humanTaskService?: HumanTaskService;
  knowledgeService?: KnowledgeService;
  telemetryService?: TelemetryService;
  tripService: TripService;
};
