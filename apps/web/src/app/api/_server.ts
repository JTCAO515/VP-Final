import {
  appRouter,
  createDb,
  createDbAgentTraceService,
  createDbCompletionJobService,
  createDbHumanTaskService,
  createDbKnowledgeService,
  createDbVersionedTripService,
  createDemoCopilotModelDependencies,
  createInMemoryCompletionJobService,
  createInMemoryKnowledgeService,
  createInMemoryHumanTaskService,
  createInMemoryAgentTraceService,
  createVersionedInMemoryTripService,
  createModelCompleteDay,
  createQStashCompletionQueue,
  resolveQStashCompletionQueueConfig,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type AgentTraceService,
  type CompleteDay,
  type CompletionJobService,
  type CompletionQueue,
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
  completionJobService?: CompletionJobService;
  completionQueue?: CompletionQueue;
  completionDay?: CompleteDay;
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
    const tripService = createVersionedInMemoryTripService();
    return {
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService,
      completionJobService: createInMemoryCompletionJobService(tripService),
    };
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new WebRuntimeUnavailableError("database_url_missing");
  const db = createDb(databaseUrl);
  const traceService = createDbAgentTraceService(db);
  const completionQueue = resolveCompletionQueue(environment);
  return {
    humanTaskService: createDbHumanTaskService(db),
    knowledgeService: createDbKnowledgeService(db),
    traceService,
    tripService: createDbVersionedTripService(db),
    completionJobService: createDbCompletionJobService(db),
    ...(completionQueue ? { completionQueue } : {}),
    completionDay: createModelCompleteDay({ environment, traceService }),
  };
}

function resolveCompletionQueue(environment: Environment): CompletionQueue | undefined {
  try {
    return createQStashCompletionQueue(resolveQStashCompletionQueueConfig(environment));
  } catch {
    return undefined;
  }
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

export function getCompletionCallbackRuntime() {
  const services = getWebServerServices(process.env);
  if (!services.completionJobService || !services.completionQueue || !services.completionDay) {
    throw new WebRuntimeUnavailableError("completion_runtime_unavailable");
  }
  return {
    ...services,
    completionJobService: services.completionJobService,
    completionQueue: services.completionQueue,
    completionDay: services.completionDay,
  };
}
