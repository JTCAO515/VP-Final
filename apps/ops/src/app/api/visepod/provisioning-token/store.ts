import {
  createDb,
  createDbOpsAuthorizationService,
  createDbVisePodProvisioningService,
  type VisePodProvisioningService,
} from "@visepanda/app-server";

export function getVisePodProvisioningService(): VisePodProvisioningService {
  if (!process.env.DATABASE_URL) throw new Error("Ops database is not configured.");
  const db = createDb(process.env.DATABASE_URL);
  return createDbVisePodProvisioningService(db, createDbOpsAuthorizationService(db));
}
