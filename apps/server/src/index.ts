// @visepanda/app-server — placeholder entry. The real scaffold lands with its
// first feature issue (see docs/planning baseline §8 issue list); until then
// this only proves the workspace graph builds end to end.
import { DOMAIN_VERSION } from "@visepanda/domain";

export const APP = "server";
export const domainVersion = DOMAIN_VERSION;

export { appRouter } from "./router.js";
export type { AppRouter } from "./router.js";
export { createDb } from "./db/client.js";
export { createDbKnowledgeService } from "./db/knowledgeService.js";
export {
  createDbKnowledgeBulkImportService,
  KnowledgeImportValidationError,
} from "./db/knowledgeBulkImportService.js";
export { createDbHumanTaskService } from "./db/humanTaskService.js";
export { createDbAgentTraceService } from "./db/agentTraceService.js";
export { createDbOpsAuthorizationService } from "./db/opsAuthorizationService.js";
export { createDbVersionedTripService } from "./db/versionedTripService.js";
export { createDbCompletionJobService } from "./db/completionJobService.js";
export {
  adapterInventory,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  RuntimeModeSchema,
} from "./runtime/runtimeMode.js";
export { requireService } from "./runtime/requireService.js";
export { createInMemoryKnowledgeService } from "./modules/knowledge/service.js";
export {
  HUMAN_TASK_DAILY_CAPACITY,
  HUMAN_TASK_PREVIEW_CITY,
  HUMAN_TASK_TERMINAL_RETENTION_DAYS,
  HumanTaskCapacityError,
  HumanTaskIdempotencyConflictError,
  HumanTaskNotFoundError,
  HumanTaskPreviewScopeError,
  HumanTaskTransitionForbiddenError,
  HumanTaskTransitionPolicyError,
  createInMemoryHumanTaskService,
} from "./modules/task/service.js";
export { createInMemoryAgentTraceService, normalizeAgentFailure } from "./modules/trace/service.js";
export { createInMemoryCompletionJobService } from "./modules/copilot/completionJobService.js";
export {
  CompletionDeliverySchema,
  CompletionQueueUnavailableError,
  createQStashCompletionQueue,
  resolveQStashCompletionQueueConfig,
} from "./modules/copilot/completionQueue.js";
export { createCompletionProcessor } from "./modules/copilot/completionProcessor.js";
export {
  createModelCompleteDay,
  parseGeneratedBlock,
} from "./modules/copilot/completionDayModel.js";
export {
  createDemoCopilotModelDependencies,
  createDemoModelRuntime,
  DemoModelExecutionError,
  DemoModelUnavailableError,
} from "./modules/copilot/modelRuntime.js";
export {
  createInMemoryOpsAuthorizationService,
  OpsForbiddenError,
  OpsPermissionSchema,
  OpsRoleSchema,
  OpsUnauthorizedError,
  permissionsForRole,
  requireOpsAccess,
} from "./modules/opsAuthorization/service.js";
export {
  createVersionedInMemoryTripService,
  TripVersionConflictError,
} from "./modules/trip/versionedService.js";
export type { RequestIdentity } from "./context.js";
export type { AdapterAvailability, RuntimeMode, RuntimeResolution } from "./runtime/runtimeMode.js";
export type { KnowledgeService } from "./modules/knowledge/service.js";
export type {
  ClaimedCompletionJob,
  CompletionJobService,
  CreateCompletionJobInput,
} from "./modules/copilot/completionJobService.js";
export type {
  CompletionDelivery,
  CompletionQueue,
  QStashCompletionQueueConfig,
} from "./modules/copilot/completionQueue.js";
export type {
  CompleteDay,
  CompletionProcessResult,
} from "./modules/copilot/completionProcessor.js";
export type {
  KnowledgeBulkImportService,
  KnowledgeImportReport,
} from "./db/knowledgeBulkImportService.js";
export type {
  CreateHumanTaskCommand,
  HumanTaskIdentity,
  HumanTaskService,
  HumanTaskTransitionResult,
  TransitionHumanTaskCommand,
} from "./modules/task/service.js";
export type {
  AgentAttemptTrace,
  AgentTraceService,
  RecordAgentRunInput,
  ToolCallTrace,
} from "./modules/trace/service.js";
export type {
  OpsAccess,
  OpsAuditEvent,
  OpsAuthorizationService,
  OpsMembership,
  OpsPermission,
  OpsRole,
  RecordOpsAuditInput,
} from "./modules/opsAuthorization/service.js";
export type {
  ApplyTripPatchInput,
  ClaimIdentity,
  TripCompletionProvenance,
  TripEvent,
  TripEventSource,
  TripIdentity,
  TripSnapshot,
  VersionedTripService,
} from "./modules/trip/versionedService.js";
