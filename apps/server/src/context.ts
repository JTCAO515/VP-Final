import type { VersionedTripService } from "./modules/trip/versionedService.js";
import type { KnowledgeService } from "./modules/knowledge/service.js";
import type { TelemetryService } from "./modules/telemetry/service.js";
import type { HumanTaskService } from "./modules/task/service.js";
import type { AgentTraceService, CopilotProductEventService } from "./modules/trace/service.js";
import type { CopilotPipelineDependencies } from "./modules/copilot/service.js";
import type { CompletionJobService } from "./modules/copilot/completionJobService.js";
import type { CompletionQueue } from "./modules/copilot/completionQueue.js";
import type { AnonymousTurnCounter } from "./modules/copilot/anonymousTurnCounter.js";

export type RequestIdentity =
  | { kind: "anonymous"; anonId: string }
  | { kind: "authenticated"; userId: string; email?: string; anonId?: string }
  | { kind: "none" };

export type ServerContext = {
  identity?: RequestIdentity;
  humanTaskService?: HumanTaskService;
  knowledgeService?: KnowledgeService;
  telemetryService?: TelemetryService;
  traceService?: AgentTraceService;
  productEventService?: CopilotProductEventService;
  copilotModelDependencies?: Pick<CopilotPipelineDependencies, "routeIntent" | "generateEnvelope">;
  completionJobService?: CompletionJobService;
  completionQueue?: CompletionQueue;
  anonymousTurnCounter?: AnonymousTurnCounter;
  demoDialogueOnly?: boolean;
  tripService: VersionedTripService;
};
