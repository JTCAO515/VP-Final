import type { TripService } from "./modules/trip/service.js";
import type { KnowledgeService } from "./modules/knowledge/service.js";
import type { TelemetryService } from "./modules/telemetry/service.js";

export type ServerContext = {
  knowledgeService?: KnowledgeService;
  telemetryService?: TelemetryService;
  tripService: TripService;
};
