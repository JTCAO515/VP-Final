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
export { createDbCommerceService } from "./db/commerceService.js";
export { createDbPartnerAdministrationService } from "./db/partnerAdministrationService.js";
export { createDbAgentTraceService } from "./db/agentTraceService.js";
export type { DbAgentTraceService } from "./db/agentTraceService.js";
export { createDbTelemetryService } from "./db/telemetryService.js";
export { createDbOpsAuthorizationService } from "./db/opsAuthorizationService.js";
export { createDbOpsCostSummaryService } from "./db/opsCostSummaryService.js";
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
  HumanTaskEvidencePolicyError,
  createInMemoryHumanTaskService,
} from "./modules/task/service.js";
export { createInMemoryAgentTraceService, normalizeAgentFailure } from "./modules/trace/service.js";
export {
  createInMemoryTelemetryService,
  prepareTelemetryEvent,
} from "./modules/telemetry/service.js";
export {
  opaqueCopilotSessionId,
  resolveCopilotRetentionPolicy,
  retentionDeadline,
} from "./modules/observability/copilotPersistence.js";
export { resolveDailyLlmBudgetUsd } from "./modules/observability/dailyBudget.js";
export { createInMemoryCompletionJobService } from "./modules/copilot/completionJobService.js";
export {
  ANONYMOUS_TURN_TTL_SECONDS,
  DEFAULT_ANONYMOUS_TURN_LIMIT,
  AnonymousTurnCapacityReservedError,
  AnonymousTurnControlUnavailableError,
  AnonymousTurnLimitExceededError,
  createInMemoryAnonymousTurnCounter,
  createUpstashAnonymousTurnCounter,
  resolveUpstashAnonymousTurnCounterConfig,
} from "./modules/copilot/anonymousTurnCounter.js";
export {
  COPILOT_IP_RATE_LIMIT_TTL_SECONDS,
  DEFAULT_COPILOT_IP_HOUR_LIMIT,
  DEFAULT_COPILOT_IP_MINUTE_LIMIT,
  CopilotIpRateLimitUnavailableError,
  createInMemoryCopilotIpRateLimiter,
  createUpstashCopilotIpRateLimiter,
  resolveUpstashCopilotIpRateLimiterConfig,
} from "./modules/copilot/ipRateLimiter.js";
export {
  DEFAULT_TELEMETRY_IDENTITY_HOUR_LIMIT,
  DEFAULT_TELEMETRY_IDENTITY_MINUTE_LIMIT,
  DEFAULT_TELEMETRY_IP_HOUR_LIMIT,
  DEFAULT_TELEMETRY_IP_MINUTE_LIMIT,
  TELEMETRY_RATE_LIMIT_TTL_SECONDS,
  TelemetryRateLimitUnavailableError,
  createInMemoryTelemetryRateLimiter,
  createUpstashTelemetryRateLimiter,
  resolveUpstashTelemetryRateLimiterConfig,
} from "./modules/telemetry/rateLimiter.js";
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
  costWindow,
  privateIdentityReference,
  requireCostRead,
} from "./modules/costSummary/service.js";
export {
  createVersionedInMemoryTripService,
  TripVersionConflictError,
} from "./modules/trip/versionedService.js";
export {
  createCommerceService,
  InvalidOutboundTargetError,
  PartnerUnavailableError,
} from "./modules/commerce/service.js";
export {
  createInMemoryPartnerAdministrationService,
  createPartnerAdministrationService,
  PartnerActivationConfirmationError,
  PartnerAdministrationForbiddenError,
  PartnerConfigurationConflictError,
  PartnerConfigurationInputSchema,
  PartnerConfigurationNotFoundError,
  PartnerStatusChangeInputSchema,
} from "./modules/commerce/partnerAdministration.js";
export { OutboundRedirectInputSchema } from "./modules/commerce/router.js";
export type { RequestIdentity } from "./context.js";
export type { AdapterAvailability, RuntimeMode, RuntimeResolution } from "./runtime/runtimeMode.js";
export type { KnowledgeService } from "./modules/knowledge/service.js";
export type {
  PostHogConfig,
  TelemetryInput,
  TelemetryService,
  TelemetryServiceOptions,
} from "./modules/telemetry/service.js";
export type {
  CommerceService,
  CreateOutboundRedirectCommand,
  OutboundClickWriter,
  OutboundIdentity,
  OutboundRedirect,
} from "./modules/commerce/service.js";
export type {
  PartnerAdministrationService,
  PartnerAdministrationStore,
  PartnerAuditInput,
  PartnerConfiguration,
  PartnerConfigurationField,
  PartnerConfigurationInput,
  PartnerStatusChangeInput,
} from "./modules/commerce/partnerAdministration.js";
export type {
  AnonymousTurnAdmission,
  AnonymousTurnCounter,
  AnonymousTurnReservation,
  UpstashAnonymousTurnCounterConfig,
} from "./modules/copilot/anonymousTurnCounter.js";
export type {
  CopilotIpRateLimitAdmission,
  CopilotIpRateLimiter,
  UpstashCopilotIpRateLimiterConfig,
} from "./modules/copilot/ipRateLimiter.js";
export type {
  TelemetryRateLimitAdmission,
  TelemetryRateLimiter,
  UpstashTelemetryRateLimiterConfig,
} from "./modules/telemetry/rateLimiter.js";
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
  UpdateHumanTaskNoteCommand,
  AppendHumanTaskEvidenceCommand,
} from "./modules/task/service.js";
export type {
  AgentAttemptTrace,
  AgentTraceService,
  CopilotProductEventService,
  RecordAgentRunInput,
  RecordCopilotProductEventInput,
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
  CopilotCostDailySummary,
  CopilotCostIdentitySummary,
  CopilotCostModelSummary,
  CopilotCostReconciliationSummary,
  CopilotCostSummary,
  OpsCostSummaryService,
} from "./modules/costSummary/service.js";
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
