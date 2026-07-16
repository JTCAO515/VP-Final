import {
  appRouter,
  createDb,
  createDbAgentTraceService,
  createDbHumanTaskService,
  createDbKnowledgeService,
  createDbVersionedTripService,
  createDemoCopilotModelDependencies,
  createInMemoryKnowledgeService,
  createInMemoryHumanTaskService,
  createInMemoryAgentTraceService,
  createVersionedInMemoryTripService,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type AgentTraceService,
  type HumanTaskService,
  type KnowledgeService,
  type RequestIdentity,
  type VersionedTripService,
} from "@visepanda/app-server";

type Environment = Readonly<Record<string, string | undefined>>;
type WebServerServices = {
  humanTaskService: HumanTaskService;
  knowledgeService: KnowledgeService;
  traceService: AgentTraceService;
  tripService: VersionedTripService;
};

const store = globalThis as typeof globalThis & {
  __visepandaDemoServices?: WebServerServices;
  __visepandaDurableServices?: WebServerServices;
  __visepandaTestServices?: WebServerServices;
};

export class WebRuntimeUnavailableError extends Error {
  readonly code = "RUNTIME_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("The durable VisePanda service is unavailable.");
    this.name = "WebRuntimeUnavailableError";
  }
}

export function getServerCaller(identity?: RequestIdentity) {
  const runtime = resolveRuntimeMode(process.env);
  const modelContext =
    runtime.ok && runtime.mode !== "test" && runtime.mode !== "local-demo"
      ? {
          copilotModelDependencies: createDemoCopilotModelDependencies(process.env),
          demoDialogueOnly: true,
        }
      : {};
  return appRouter.createCaller({
    ...(identity ? { identity } : {}),
    ...getWebServerServices(process.env),
    ...modelContext,
  });
}

export function createWebServerServices(environment: Environment): WebServerServices {
  const runtime = resolveRuntimeMode(environment);
  if (!runtime.ok) throw new WebRuntimeUnavailableError(runtime.code);

  if (runtime.mode === "test") {
    if (!store.__visepandaTestServices) {
      throw new WebRuntimeUnavailableError("test_adapter_missing");
    }
    return store.__visepandaTestServices;
  }

  const availability = resolveDatabaseAdapter(runtime, environment);
  if (availability.status === "unavailable" || !availability.adapter) {
    throw new WebRuntimeUnavailableError(availability.code ?? "database_unavailable");
  }

  if (availability.adapter === "memory-demo") {
    return {
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    };
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new WebRuntimeUnavailableError("database_url_missing");
  const db = createDb(databaseUrl);
  return {
    humanTaskService: createDbHumanTaskService(db),
    knowledgeService: createDbKnowledgeService(db),
    traceService: createDbAgentTraceService(db),
    tripService: createDbVersionedTripService(db),
  };
}

function getWebServerServices(environment: Environment): WebServerServices {
  const runtime = resolveRuntimeMode(environment);
  if (runtime.ok && runtime.mode === "local-demo" && !environment.DATABASE_URL) {
    store.__visepandaDemoServices ??= createWebServerServices(environment);
    return store.__visepandaDemoServices;
  }
  if (runtime.ok && runtime.mode !== "test") {
    store.__visepandaDurableServices ??= createWebServerServices(environment);
    return store.__visepandaDurableServices;
  }
  return createWebServerServices(environment);
}

export function setTestWebServerServices(services: WebServerServices | null): void {
  if (services) store.__visepandaTestServices = services;
  else delete store.__visepandaTestServices;
}
