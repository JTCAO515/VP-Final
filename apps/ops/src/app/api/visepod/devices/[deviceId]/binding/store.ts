import {
  createDb,
  createDbOpsAuthorizationService,
  createDbVisePodBindingService,
  createDbVisePodProvisioningService,
  resolveVisePodKnownDeviceCatalog,
  resolveVisePodStudioEnvironment,
  type VisePodBindingService,
} from "@visepanda/app-server";
import type { VisePodStudioEnvironment } from "@visepanda/domain";

export type VisePodBindingRuntime = {
  environment: VisePodStudioEnvironment;
  service: VisePodBindingService;
};

export function getVisePodBindingRuntime(): VisePodBindingRuntime {
  if (!process.env.DATABASE_URL) throw new Error("Ops database is not configured.");
  const db = createDb(process.env.DATABASE_URL);
  const authorization = createDbOpsAuthorizationService(db);
  return {
    environment: resolveVisePodStudioEnvironment(process.env.VISEPOD_STUDIO_ENVIRONMENT),
    service: createDbVisePodBindingService(
      db,
      createDbVisePodProvisioningService(db, authorization),
      resolveVisePodKnownDeviceCatalog(process.env.VISEPOD_STUDIO_DEVICE_IDS),
    ),
  };
}
