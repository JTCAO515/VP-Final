import {
  appRouter,
  createDb,
  createDbAgentTraceService,
  createDbEarlyAccessSignupService,
  createDbCompletionJobService,
  createDbHumanTaskService,
  createDbHumanTaskPaymentWebhookService,
  createDbReadinessService,
  createDbCommerceService,
  createDbKnowledgeService,
  createDbSeoEditorialOverrideService,
  createDbSafePhraseResolver,
  createDbTelemetryService,
  createDbVersionedTripService,
  createDemoCopilotModelDependencies,
  reportDemoProviderReadiness,
  resolveReadinessRetentionDays,
  createInMemoryAnonymousTurnCounter,
  createInMemoryAuthenticatedCopilotRateLimiter,
  createInMemoryCopilotIpRateLimiter,
  createInMemoryCompletionJobService,
  createInMemoryKnowledgeService,
  createInMemorySeoEditorialOverrideService,
  createInMemoryHumanTaskService,
  createInMemoryAgentTraceService,
  createInMemoryEarlyAccessRateLimiter,
  createInMemoryEarlyAccessConfirmationEmailSender,
  createInMemoryEarlyAccessSignupService,
  createInMemoryTelemetryService,
  createInMemoryTelemetryRateLimiter,
  createInMemoryReadinessService,
  createVersionedInMemoryTripService,
  createModelCompleteDay,
  createQStashCompletionQueue,
  createUpstashAnonymousTurnCounter,
  createUpstashAuthenticatedCopilotRateLimiter,
  createUpstashCopilotIpRateLimiter,
  createUpstashTelemetryRateLimiter,
  createUpstashEarlyAccessRateLimiter,
  createResendEarlyAccessConfirmationEmailSender,
  resolveQStashCompletionQueueConfig,
  resolveUpstashAnonymousTurnCounterConfig,
  resolveUpstashAuthenticatedCopilotRateLimiterConfig,
  resolveUpstashCopilotIpRateLimiterConfig,
  resolveUpstashTelemetryRateLimiterConfig,
  resolveEarlyAccessRateLimiterConfig,
  resolveEarlyAccessConfirmationEmailConfig,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  resolveStripeWebhookConfig,
  type AgentTraceService,
  type AnonymousTurnCounter,
  type AuthenticatedCopilotRateLimiter,
  type CopilotIpRateLimiter,
  type EarlyAccessRateLimiter,
  type EarlyAccessConfirmationEmailSender,
  type EarlyAccessSignupService,
  type CopilotProductEventService,
  type CompleteDay,
  type CompletionJobService,
  type CompletionQueue,
  type HumanTaskService,
  type HumanTaskPaymentWebhookService,
  type CommerceService,
  type KnowledgeService,
  type TelemetryService,
  type TelemetryRateLimiter,
  type RequestIdentity,
  type ReadinessService,
  type SafePhraseResolver,
  type SeoEditorialOverrideService,
  type VersionedTripService,
} from "./index.js";

export type WebCompositionEnvironment = Readonly<Record<string, string | undefined>>;
export type DeferTask = (task: () => Promise<void>) => void;
export type WebServerServices = {
  humanTaskService: HumanTaskService;
  knowledgeService: KnowledgeService;
  traceService: AgentTraceService;
  productEventService?: CopilotProductEventService;
  tripService: VersionedTripService;
  readinessService?: ReadinessService;
  completionJobService?: CompletionJobService;
  completionQueue?: CompletionQueue;
  completionDay?: CompleteDay;
  anonymousTurnCounter?: AnonymousTurnCounter;
  authenticatedCopilotRateLimiter?: AuthenticatedCopilotRateLimiter;
  copilotIpRateLimiter?: CopilotIpRateLimiter;
  telemetryRateLimiter?: TelemetryRateLimiter;
  earlyAccessRateLimiter?: EarlyAccessRateLimiter;
  earlyAccessConfirmationEmailSender?: EarlyAccessConfirmationEmailSender;
  earlyAccessSignupService?: EarlyAccessSignupService;
  commerceService?: CommerceService;
  telemetryService?: TelemetryService;
  safePhraseResolver?: SafePhraseResolver;
  seoEditorialOverrideService?: SeoEditorialOverrideService;
  humanTaskPaymentWebhookService?: HumanTaskPaymentWebhookService;
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

export function getServerCaller(
  identity?: RequestIdentity,
  deferTask?: DeferTask,
): ReturnType<typeof appRouter.createCaller> {
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

export function createWebServerServices(environment: WebCompositionEnvironment): WebServerServices {
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
      seoEditorialOverrideService: createInMemorySeoEditorialOverrideService(),
      traceService,
      productEventService: traceService,
      telemetryService,
      tripService,
      readinessService: createInMemoryReadinessService({ tripService }),
      completionJobService: createInMemoryCompletionJobService(tripService),
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter(),
      authenticatedCopilotRateLimiter: createInMemoryAuthenticatedCopilotRateLimiter(),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      telemetryRateLimiter: createInMemoryTelemetryRateLimiter(),
      earlyAccessRateLimiter: createInMemoryEarlyAccessRateLimiter(),
      earlyAccessConfirmationEmailSender: createInMemoryEarlyAccessConfirmationEmailSender(),
      earlyAccessSignupService: createInMemoryEarlyAccessSignupService(),
    };
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new WebRuntimeUnavailableError("database_url_missing");
  const db = createDb(databaseUrl);
  const readinessRetentionDays = resolveReadinessRetentionDays(environment);
  reportDemoProviderReadiness(environment);
  const traceService = createDbAgentTraceService(db);
  const telemetryService = createDbTelemetryService(db, { environment });
  const completionQueue = resolveCompletionQueue(environment);
  const anonymousTurnCounter = resolveAnonymousTurnCounter(environment);
  const authenticatedCopilotRateLimiter = resolveAuthenticatedCopilotRateLimiter(environment);
  const copilotIpRateLimiter = resolveCopilotIpRateLimiter(environment);
  const telemetryRateLimiter = resolveTelemetryRateLimiter(environment);
  const earlyAccessRateLimiter = resolveEarlyAccessRateLimiter(environment);
  const earlyAccessConfirmationEmailSender = resolveEarlyAccessConfirmationEmailSender(environment);
  const tripService = createDbVersionedTripService(db);
  return {
    humanTaskService: createDbHumanTaskService(db),
    ...(resolveStripeWebhookConfig(environment)
      ? { humanTaskPaymentWebhookService: createDbHumanTaskPaymentWebhookService(db) }
      : {}),
    commerceService: createDbCommerceService(db, { telemetryService }),
    knowledgeService: createDbKnowledgeService(db),
    seoEditorialOverrideService: createDbSeoEditorialOverrideService(db),
    traceService,
    productEventService: traceService,
    telemetryService,
    earlyAccessSignupService: createDbEarlyAccessSignupService(db),
    safePhraseResolver: createDbSafePhraseResolver(db),
    tripService,
    readinessService: createDbReadinessService(db, {
      retentionDays: readinessRetentionDays,
    }),
    completionJobService: createDbCompletionJobService(db),
    ...(completionQueue ? { completionQueue } : {}),
    ...(anonymousTurnCounter ? { anonymousTurnCounter } : {}),
    ...(authenticatedCopilotRateLimiter ? { authenticatedCopilotRateLimiter } : {}),
    ...(copilotIpRateLimiter ? { copilotIpRateLimiter } : {}),
    ...(telemetryRateLimiter ? { telemetryRateLimiter } : {}),
    ...(earlyAccessRateLimiter ? { earlyAccessRateLimiter } : {}),
    ...(earlyAccessConfirmationEmailSender ? { earlyAccessConfirmationEmailSender } : {}),
    completionDay: createModelCompleteDay({ environment, traceService }),
  };
}

function resolveCopilotIpRateLimiter(
  environment: WebCompositionEnvironment,
): CopilotIpRateLimiter | undefined {
  try {
    return createUpstashCopilotIpRateLimiter(resolveUpstashCopilotIpRateLimiterConfig(environment));
  } catch {
    return undefined;
  }
}

function resolveAuthenticatedCopilotRateLimiter(
  environment: WebCompositionEnvironment,
): AuthenticatedCopilotRateLimiter | undefined {
  try {
    return createUpstashAuthenticatedCopilotRateLimiter(
      resolveUpstashAuthenticatedCopilotRateLimiterConfig(environment),
    );
  } catch {
    return undefined;
  }
}

function resolveTelemetryRateLimiter(
  environment: WebCompositionEnvironment,
): TelemetryRateLimiter | undefined {
  try {
    return createUpstashTelemetryRateLimiter(resolveUpstashTelemetryRateLimiterConfig(environment));
  } catch {
    return undefined;
  }
}

function resolveEarlyAccessRateLimiter(
  environment: WebCompositionEnvironment,
): EarlyAccessRateLimiter | undefined {
  try {
    return createUpstashEarlyAccessRateLimiter(resolveEarlyAccessRateLimiterConfig(environment));
  } catch {
    return undefined;
  }
}

function resolveEarlyAccessConfirmationEmailSender(
  environment: WebCompositionEnvironment,
): EarlyAccessConfirmationEmailSender | undefined {
  try {
    return createResendEarlyAccessConfirmationEmailSender(
      resolveEarlyAccessConfirmationEmailConfig(environment),
    );
  } catch {
    return undefined;
  }
}

function resolveAnonymousTurnCounter(
  environment: WebCompositionEnvironment,
): AnonymousTurnCounter | undefined {
  try {
    return createUpstashAnonymousTurnCounter(resolveUpstashAnonymousTurnCounterConfig(environment));
  } catch {
    return undefined;
  }
}

function resolveCompletionQueue(
  environment: WebCompositionEnvironment,
): CompletionQueue | undefined {
  try {
    return createQStashCompletionQueue(resolveQStashCompletionQueueConfig(environment));
  } catch {
    return undefined;
  }
}

function getWebServerServices(environment: WebCompositionEnvironment): WebServerServices {
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

export function getEarlyAccessRateLimiter(): EarlyAccessRateLimiter | undefined {
  return getWebServerServices(process.env).earlyAccessRateLimiter;
}

export function getEarlyAccessConfirmationEmailSender():
  EarlyAccessConfirmationEmailSender | undefined {
  return getWebServerServices(process.env).earlyAccessConfirmationEmailSender;
}

export function getEarlyAccessSignupService(): EarlyAccessSignupService {
  const service = getWebServerServices(process.env).earlyAccessSignupService;
  if (!service) throw new WebRuntimeUnavailableError("early_access_signup_unavailable");
  return service;
}

export function getSeoEditorialOverrideService(): SeoEditorialOverrideService | undefined {
  return getWebServerServices(process.env).seoEditorialOverrideService;
}

/** Only a durable, explicitly payment-enabled runtime may receive provider webhooks. */
export function getHumanTaskPaymentWebhookService(): HumanTaskPaymentWebhookService {
  const service = getWebServerServices(process.env).humanTaskPaymentWebhookService;
  if (!service) throw new WebRuntimeUnavailableError("payment_webhook_unavailable");
  return service;
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
