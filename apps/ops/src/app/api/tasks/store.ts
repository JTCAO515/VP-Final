import {
  createDb,
  createDbHumanTaskService,
  createInMemoryHumanTaskService,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type HumanTaskService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaOpsDemoHumanTasks?: HumanTaskService;
  __visepandaOpsDurableHumanTasks?: HumanTaskService;
  __visepandaOpsTestHumanTasks?: HumanTaskService;
};

export function getHumanTaskService(): HumanTaskService {
  const runtime = resolveRuntimeMode(process.env);
  if (runtime.ok && runtime.mode !== "test" && runtime.mode !== "local-demo") {
    store.__visepandaOpsDurableHumanTasks ??= createOpsHumanTaskService(process.env);
    return store.__visepandaOpsDurableHumanTasks;
  }
  return createOpsHumanTaskService(process.env);
}

export function createOpsHumanTaskService(
  environment: Readonly<Record<string, string | undefined>>,
): HumanTaskService {
  const runtime = resolveRuntimeMode(environment);
  if (!runtime.ok) throw new Error("Ops Human Tasks are unavailable.");
  if (runtime.mode === "test") {
    if (!store.__visepandaOpsTestHumanTasks) {
      throw new Error("Ops test Human Tasks are not injected.");
    }
    return store.__visepandaOpsTestHumanTasks;
  }

  const availability = resolveDatabaseAdapter(runtime, environment);
  if (availability.adapter === "memory-demo") {
    store.__visepandaOpsDemoHumanTasks ??= createInMemoryHumanTaskService();
    return store.__visepandaOpsDemoHumanTasks;
  }
  if (availability.status !== "ready" || !environment.DATABASE_URL) {
    throw new Error("Ops Human Tasks are unavailable.");
  }
  return createDbHumanTaskService(createDb(environment.DATABASE_URL));
}

export function setTestOpsHumanTaskService(service: HumanTaskService | null): void {
  if (service) store.__visepandaOpsTestHumanTasks = service;
  else delete store.__visepandaOpsTestHumanTasks;
}
