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
export { createDbOpsAuthorizationService } from "./db/opsAuthorizationService.js";
export { createDbVersionedTripService } from "./db/versionedTripService.js";
export { createInMemoryKnowledgeService } from "./modules/knowledge/service.js";
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
export type { KnowledgeService } from "./modules/knowledge/service.js";
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
  TripEvent,
  TripEventSource,
  TripIdentity,
  TripSnapshot,
  VersionedTripService,
} from "./modules/trip/versionedService.js";
