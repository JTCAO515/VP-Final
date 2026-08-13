import {
  appRouter,
  createDb,
  createDbAgentTraceService,
  createDbCompletionJobService,
  createDbHumanTaskService,
  createDbCommerceService,
  createDbKnowledgeService,
  createDbSafePhraseResolver,
  createDbTelemetryService,
  createDbVersionedTripService,
  createDemoCopilotModelDependencies,
  createInMemoryAnonymousTurnCounter,
  createInMemoryAuthenticatedCopilotRateLimiter,
  createInMemoryCopilotIpRateLimiter,
  createInMemoryCompletionJobService,
  createInMemoryKnowledgeService,
  createInMemoryHumanTaskService,
  createInMemoryAgentTraceService,
  createInMemoryTelemetryService,
  createInMemoryTelemetryRateLimiter,
  createVersionedInMemoryTripService,
  createModelCompleteDay,
  createQStashCompletionQueue,
  createUpstashAnonymousTurnCounter,
  createUpstashAuthenticatedCopilotRateLimiter,
  createUpstashCopilotIpRateLimiter,
  createUpstashTelemetryRateLimiter,
  resolveQStashCompletionQueueConfig,
  resolveUpstashAnonymousTurnCounterConfig,
  resolveUpstashAuthenticatedCopilotRateLimiterConfig,
  resolveUpstashCopilotIpRateLimiterConfig,
  resolveUpstashTelemetryRateLimiterConfig,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type AgentTraceService,
  type AnonymousTurnCounter,
  type AuthenticatedCopilotRateLimiter,
  type CopilotIpRateLimiter,
  type CopilotProductEventService,
  type CompleteDay,
  type CompletionJobService,
  type CompletionQueue,
  type HumanTaskService,
  type CommerceService,
  type KnowledgeService,
  type TelemetryService,
  type TelemetryRateLimiter,
  type RequestIdentity,
  type SafePhraseResolver,
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
  authenticatedCopilotRateLimiter?: AuthenticatedCopilotRateLimiter;
  copilotIpRateLimiter?: CopilotIpRateLimiter;
  telemetryRateLimiter?: TelemetryRateLimiter;
  commerceService?: CommerceService;
  telemetryService?: TelemetryService;
  safePhraseResolver?: SafePhraseResolver;
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
    const telemetryService = createInMemoryTelemetryService({ environment });
    return {
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService,
      productEventService: traceService,
      telemetryService,
      tripService,
      completionJobService: createInMemoryCompletionJobService(tripService),
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter(),
      authenticatedCopilotRateLimiter: createInMemoryAuthenticatedCopilotRateLimiter(),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      telemetryRateLimiter: createInMemoryTelemetryRateLimiter(),
    };
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new WebRuntimeUnavailableError("database_url_missing");
  const db = createDb(databaseUrl);
  const traceService = createDbAgentTraceService(db);
  const telemetryService = createDbTelemetryService(db, { environment });
  const completionQueue = resolveCompletionQueue(environment);
  const anonymousTurnCounter = resolveAnonymousTurnCounter(environment);
  const authenticatedCopilotRateLimiter = resolveAuthenticatedCopilotRateLimiter(environment);
  const copilotIpRateLimiter = resolveCopilotIpRateLimiter(environment);
  const telemetryRateLimiter = resolveTelemetryRateLimiter(environment);
  return {
    humanTaskService: createDbHumanTaskService(db),
    commerceService: createDbCommerceService(db, { telemetryService }),
    knowledgeService: createDbKnowledgeService(db),
    traceService,
    productEventService: traceService,
    telemetryService,
    safePhraseResolver: createDbSafePhraseResolver(db),
    tripService: createDbVersionedTripService(db),
    completionJobService: createDbCompletionJobService(db),
    ...(completionQueue ? { completionQueue } : {}),
    ...(anonymousTurnCounter ? { anonymousTurnCounter } : {}),
    ...(authenticatedCopilotRateLimiter ? { authenticatedCopilotRateLimiter } : {}),
    ...(copilotIpRateLimiter ? { copilotIpRateLimiter } : {}),
    ...(telemetryRateLimiter ? { telemetryRateLimiter } : {}),
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

function resolveAuthenticatedCopilotRateLimiter(
  environment: Environment,
): AuthenticatedCopilotRateLimiter | undefined {
  try {
    return createUpstashAuthenticatedCopilotRateLimiter(
      resolveUpstashAuthenticatedCopilotRateLimiterConfig(environment),
    );
  } catch {
    return undefined;
  }
}

function resolveTelemetryRateLimiter(environment: Environment): TelemetryRateLimiter | undefined {
  try {
    return createUpstashTelemetryRateLimiter(resolveUpstashTelemetryRateLimiterConfig(environment));
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

export function getAuthenticatedCopilotRateLimiter(): AuthenticatedCopilotRateLimiter | undefined {
  return getWebServerServices(process.env).authenticatedCopilotRateLimiter;
}

export function getTelemetryRateLimiter(): TelemetryRateLimiter | undefined {
  return getWebServerServices(process.env).telemetryRateLimiter;
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
  const telemetryService = services.telemetryService
    ? {
        track(input: Parameters<TelemetryService["track"]>[0]) {
          return scheduleDeferredTelemetry(deferTask, () =>
            services.telemetryService!.track(input),
          );
        },
      }
    : undefined;
  return {
    ...services,
    traceService,
    ...(productEventService ? { productEventService } : {}),
    ...(telemetryService ? { telemetryService } : {}),
  };
}

function scheduleDeferredTelemetry<T>(deferTask: DeferTask, write: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const task = async () => {
      try {
        resolve(await write());
      } catch (error) {
        reject(error);
      }
    };
    try {
      deferTask(task);
    } catch {
      void task();
    }
  });
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
