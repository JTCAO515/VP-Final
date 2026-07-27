import {
  createDb,
  createDbPartnerAdministrationService,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type PartnerAdministrationService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaOpsPartnerAdministration?: PartnerAdministrationService;
  __visepandaOpsTestPartnerAdministration?: PartnerAdministrationService;
};

export function getPartnerAdministrationService(): PartnerAdministrationService {
  const runtime = resolveRuntimeMode(process.env);
  if (!runtime.ok) throw new Error("Ops Partner administration is unavailable.");
  if (runtime.mode === "test") {
    if (!store.__visepandaOpsTestPartnerAdministration) {
      throw new Error("Ops test Partner administration is not injected.");
    }
    return store.__visepandaOpsTestPartnerAdministration;
  }
  if (runtime.mode === "local-demo") {
    throw new Error("Partner administration requires the durable database adapter.");
  }
  const availability = resolveDatabaseAdapter(runtime, process.env);
  if (availability.status !== "ready" || !process.env.DATABASE_URL) {
    throw new Error("Ops Partner administration is unavailable.");
  }
  store.__visepandaOpsPartnerAdministration ??= createDbPartnerAdministrationService(
    createDb(process.env.DATABASE_URL),
  );
  return store.__visepandaOpsPartnerAdministration;
}

export function setTestPartnerAdministrationService(
  service: PartnerAdministrationService | null,
): void {
  if (service) store.__visepandaOpsTestPartnerAdministration = service;
  else delete store.__visepandaOpsTestPartnerAdministration;
}
