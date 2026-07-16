import {
  createDb,
  createDbKnowledgeBulkImportService,
  createDbKnowledgeService,
  createInMemoryKnowledgeService,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type KnowledgeBulkImportService,
  type KnowledgeService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaOpsDemoKnowledge?: KnowledgeService;
  __visepandaOpsDurableKnowledge?: KnowledgeService;
  __visepandaOpsDurableKnowledgeImport?: KnowledgeBulkImportService;
  __visepandaOpsTestKnowledge?: KnowledgeService;
};

export function getKnowledgeService(): KnowledgeService {
  const runtime = resolveRuntimeMode(process.env);
  if (runtime.ok && runtime.mode !== "test" && runtime.mode !== "local-demo") {
    store.__visepandaOpsDurableKnowledge ??= createOpsKnowledgeService(process.env);
    return store.__visepandaOpsDurableKnowledge;
  }
  return createOpsKnowledgeService(process.env);
}

export function createOpsKnowledgeService(
  environment: Readonly<Record<string, string | undefined>>,
): KnowledgeService {
  const runtime = resolveRuntimeMode(environment);
  if (!runtime.ok) throw new Error("Ops Knowledge is unavailable.");
  if (runtime.mode === "test") {
    if (!store.__visepandaOpsTestKnowledge) throw new Error("Ops test Knowledge is not injected.");
    return store.__visepandaOpsTestKnowledge;
  }

  const availability = resolveDatabaseAdapter(runtime, environment);
  if (availability.adapter === "memory-demo") {
    store.__visepandaOpsDemoKnowledge ??= createInMemoryKnowledgeService();
    return store.__visepandaOpsDemoKnowledge;
  }
  if (availability.status !== "ready" || !environment.DATABASE_URL) {
    throw new Error("Ops Knowledge is unavailable.");
  }
  return createDbKnowledgeService(createDb(environment.DATABASE_URL));
}

export function getKnowledgeBulkImportService(): KnowledgeBulkImportService {
  const runtime = resolveRuntimeMode(process.env);
  if (!runtime.ok || runtime.mode === "test" || runtime.mode === "local-demo") {
    throw new Error("Durable knowledge import is unavailable in this runtime.");
  }
  const availability = resolveDatabaseAdapter(runtime, process.env);
  if (availability.status !== "ready" || !process.env.DATABASE_URL) {
    throw new Error("Durable knowledge import is unavailable.");
  }
  store.__visepandaOpsDurableKnowledgeImport ??= createDbKnowledgeBulkImportService(
    createDb(process.env.DATABASE_URL),
  );
  return store.__visepandaOpsDurableKnowledgeImport;
}

export function setTestOpsKnowledgeService(service: KnowledgeService | null): void {
  if (service) store.__visepandaOpsTestKnowledge = service;
  else delete store.__visepandaOpsTestKnowledge;
}
