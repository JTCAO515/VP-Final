import {
  createDb,
  createDbSeoEditorialOverrideService,
  createInMemorySeoEditorialOverrideService,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type SeoEditorialOverrideService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaOpsDemoSeoEditorialOverrides?: SeoEditorialOverrideService;
  __visepandaOpsDurableSeoEditorialOverrides?: SeoEditorialOverrideService;
  __visepandaOpsTestSeoEditorialOverrides?: SeoEditorialOverrideService;
};

export function getSeoEditorialOverrideService(): SeoEditorialOverrideService {
  const runtime = resolveRuntimeMode(process.env);
  if (!runtime.ok) throw new Error("Ops SEO editorial overrides are unavailable.");
  if (runtime.mode === "test") {
    if (!store.__visepandaOpsTestSeoEditorialOverrides) {
      throw new Error("Ops test SEO editorial overrides are not injected.");
    }
    return store.__visepandaOpsTestSeoEditorialOverrides;
  }
  if (runtime.mode === "local-demo") {
    store.__visepandaOpsDemoSeoEditorialOverrides ??= createInMemorySeoEditorialOverrideService();
    return store.__visepandaOpsDemoSeoEditorialOverrides;
  }
  const availability = resolveDatabaseAdapter(runtime, process.env);
  if (availability.status !== "ready" || !process.env.DATABASE_URL) {
    throw new Error("Ops SEO editorial overrides are unavailable.");
  }
  store.__visepandaOpsDurableSeoEditorialOverrides ??= createDbSeoEditorialOverrideService(
    createDb(process.env.DATABASE_URL),
  );
  return store.__visepandaOpsDurableSeoEditorialOverrides;
}

export function setTestSeoEditorialOverrideService(
  service: SeoEditorialOverrideService | null,
): void {
  if (service) store.__visepandaOpsTestSeoEditorialOverrides = service;
  else delete store.__visepandaOpsTestSeoEditorialOverrides;
}
