import {
  appRouter,
  createDb,
  createDbAgentTraceService,
  createDbCompletionJobService,
  createDbHumanTaskService,
  createDbKnowledgeService,
  createDbVersionedTripService,
  createDemoCopilotModelDependencies,
  createInMemoryAnonymousTurnCounter,
  createInMemoryCopilotIpRateLimiter,
  createInMemoryCompletionJobService,
  createInMemoryKnowledgeService,
  createInMemoryHumanTaskService,
  createInMemoryAgentTraceService,
  createVersionedInMemoryTripService,
  createModelCompleteDay,
  createQStashCompletionQueue,
  createUpstashAnonymousTurnCounter,
  createUpstashCopilotIpRateLimiter,
  resolveQStashCompletionQueueConfig,
  resolveUpstashAnonymousTurnCounterConfig,
  resolveUpstashCopilotIpRateLimiterConfig,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type AgentTraceService,
  type AnonymousTurnCounter,
  type CopilotIpRateLimiter,
  type CopilotProductEventService,
  type CompleteDay,
  type CompletionJobService,
  type CompletionQueue,
  type HumanTaskService,
  type KnowledgeService,
  type RequestIdentity,
  type VersionedTripService,
} from "@visepanda/app-server";

type Environment = Readonly<Record<string, string | undefined>>;
type DeferTask = (task: () => Promise<void>) => void;
type WebServerServices = {
  humanTaskService: HumanTaskService;
  knowledgeService: KnowledgeService;
  traceService: AgentTraceService;
  productEventService?: CopilotProductEventService;
  tripService: VersionedTripService;
  completionJobService?: CompletionJobService;
  completionQueue?: CompletionQueue;
  completionDay?: CompleteDay;
  anonymousTurnCounter?: AnonymousTurnCounter;
  copilotIpRateLimiter?: CopilotIpRateLimiter;
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

export function getServerCaller(identity?: RequestIdentity, deferTask?: DeferTask) {
  const runtime = resolveRuntimeMode(process.env);
  const modelContext =
    runtime.ok && runtime.mode !== "test" && runtime.mode !== "local-demo"
      ? {
          copilotModelDependencies: createDemoCopilotModelDependencies(process.env),
          demoDialogueOnly: true,
        }
      : {};
  const services = getWebServerServices(process.env);
  const requestServices = deferTask ? deferObservability(services, deferTask) : services;
  return appRouter.createCaller({
    ...(identity ? { identity } : {}),
    ...requestServices,
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
    const traceService = createInMemoryAgentTraceService();
    return {
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService,
      productEventService: traceService,
      tripService,
      completionJobService: createInMemoryCompletionJobService(tripService),
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter(),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
    };
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new WebRuntimeUnavailableError("database_url_missing");
  const db = createDb(databaseUrl);
  const traceService = createDbAgentTraceService(db);
  const completionQueue = resolveCompletionQueue(environment);
  const anonymousTurnCounter = resolveAnonymousTurnCounter(environment);
  const copilotIpRateLimiter = resolveCopilotIpRateLimiter(environment);
  return {
    humanTaskService: createDbHumanTaskService(db),
    knowledgeService: createDbKnowledgeService(db),
    traceService,
    productEventService: traceService,
    tripService: createDbVersionedTripService(db),
    completionJobService: createDbCompletionJobService(db),
    ...(completionQueue ? { completionQueue } : {}),
    ...(anonymousTurnCounter ? { anonymousTurnCounter } : {}),
    ...(copilotIpRateLimiter ? { copilotIpRateLimiter } : {}),
    completionDay: createModelCompleteDay({ environment, traceService }),
  };
}

function resolveCopilotIpRateLimiter(environment: Environment): CopilotIpRateLimiter | undefined {
  try {
    return createUpstashCopilotIpRateLimiter(resolveUpstashCopilotIpRateLimiterConfig(environment));
  } catch {
    return undefined;
  }
}

function resolveAnonymousTurnCounter(environment: Environment): AnonymousTurnCounter | undefined {
  try {
    return createUpstashAnonymousTurnCounter(resolveUpstashAnonymousTurnCounterConfig(environment));
  } catch {
    return undefined;
  }
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

export function getCopilotIpRateLimiter(): CopilotIpRateLimiter | undefined {
  return getWebServerServices(process.env).copilotIpRateLimiter;
}

export function getCopilotProductEventService(
  deferTask?: DeferTask,
): CopilotProductEventService | undefined {
  const services = getWebServerServices(process.env);
  return deferTask
    ? deferObservability(services, deferTask).productEventService
    : services.productEventService;
}

function deferObservability(services: WebServerServices, deferTask: DeferTask): WebServerServices {
  const traceService: AgentTraceService = {
    recordRun(input) {
      scheduleDeferredWrite(deferTask, () => services.traceService.recordRun(input));
      return Promise.resolve();
    },
  };
  const productEventService = services.productEventService
    ? {
        recordProductEvent(input: Parameters<CopilotProductEventService["recordProductEvent"]>[0]) {
          scheduleDeferredWrite(deferTask, () =>
            services.productEventService!.recordProductEvent(input),
          );
          return Promise.resolve();
        },
      }
    : undefined;
  return {
    ...services,
    traceService,
    ...(productEventService ? { productEventService } : {}),
  };
}

function scheduleDeferredWrite(deferTask: DeferTask, write: () => Promise<void>): void {
  const task = async () => {
    try {
      await write();
    } catch {
      console.warn("copilot_observability_write_failed", {
        failureClass: "persistence_error",
      });
    }
  };
  try {
    deferTask(task);
  } catch {
    void task();
  }
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
