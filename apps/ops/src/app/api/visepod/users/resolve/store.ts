import {
  createDb,
  createDbOpsAuthorizationService,
  createDbVisePodProvisioningService,
  createDbVisePodUserResolutionService,
  createUpstashVisePodStudioUserLookupRateLimiter,
  resolveUpstashVisePodStudioUserLookupRateLimiterConfig,
  resolveVisePodStudioEnvironment,
  type VisePodUserResolutionService,
} from "@visepanda/app-server";
import type { VisePodStudioEnvironment } from "@visepanda/domain";

export type VisePodUserResolutionRuntime = {
  environment: VisePodStudioEnvironment;
  service: VisePodUserResolutionService;
};

export function getVisePodUserResolutionRuntime(): VisePodUserResolutionRuntime {
  if (!process.env.DATABASE_URL) throw new Error("Ops database is not configured.");
  const db = createDb(process.env.DATABASE_URL);
  const authorization = createDbOpsAuthorizationService(db);
  return {
    environment: resolveVisePodStudioEnvironment(process.env.VISEPOD_STUDIO_ENVIRONMENT),
    service: createDbVisePodUserResolutionService(
      db,
      createDbVisePodProvisioningService(db, authorization),
      createUpstashVisePodStudioUserLookupRateLimiter(
        resolveUpstashVisePodStudioUserLookupRateLimiterConfig(process.env),
      ),
    ),
  };
}
