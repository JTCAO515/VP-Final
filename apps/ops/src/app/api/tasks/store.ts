import {
  createDb,
  createDbHumanTaskPaymentCheckoutService,
  createDbHumanTaskService,
  createStripeCheckoutGateway,
  createInMemoryHumanTaskService,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  resolveStripeCheckoutConfig,
  resolveStripeWebhookConfig,
  type HumanTaskPaymentCheckoutService,
  type HumanTaskService,
} from "@visepanda/app-server";

const store = globalThis as typeof globalThis & {
  __visepandaOpsDemoHumanTasks?: HumanTaskService;
  __visepandaOpsDurableHumanTasks?: HumanTaskService;
  __visepandaOpsTestHumanTasks?: HumanTaskService;
  __visepandaOpsDurableHumanTaskPaymentCheckout?: HumanTaskPaymentCheckoutService;
  __visepandaOpsTestHumanTaskPaymentCheckout?: HumanTaskPaymentCheckoutService;
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
  return createDbHumanTaskService(createDb(environment.DATABASE_URL), {
    allowPaymentPreparation: isHumanTaskPaymentPreparationAvailable(environment),
  });
}

/**
 * A quote is an Ops-only preparation state. A Checkout key without signed webhook verification is
 * not enough to create it, because it would leave a task in a payment-adjacent state that cannot
 * be safely reconciled.
 */
export function isHumanTaskPaymentPreparationAvailable(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    resolveStripeCheckoutConfig(environment) !== null &&
    resolveStripeWebhookConfig(environment) !== null
  );
}

/**
 * This is an Ops-only composition boundary. A missing or partial provider configuration never
 * creates a local session or exposes a payment link; it simply leaves the capability unavailable.
 */
export function getHumanTaskPaymentCheckoutService(): HumanTaskPaymentCheckoutService {
  const runtime = resolveRuntimeMode(process.env);
  if (runtime.ok && runtime.mode !== "test" && runtime.mode !== "local-demo") {
    store.__visepandaOpsDurableHumanTaskPaymentCheckout ??=
      createOpsHumanTaskPaymentCheckoutService(process.env);
    return store.__visepandaOpsDurableHumanTaskPaymentCheckout;
  }
  return createOpsHumanTaskPaymentCheckoutService(process.env);
}

export function createOpsHumanTaskPaymentCheckoutService(
  environment: Readonly<Record<string, string | undefined>>,
): HumanTaskPaymentCheckoutService {
  const runtime = resolveRuntimeMode(environment);
  if (!runtime.ok || runtime.mode === "local-demo") {
    throw new Error("Ops payment checkout is unavailable.");
  }
  if (runtime.mode === "test") {
    if (!store.__visepandaOpsTestHumanTaskPaymentCheckout) {
      throw new Error("Ops test payment checkout is not injected.");
    }
    return store.__visepandaOpsTestHumanTaskPaymentCheckout;
  }

  const availability = resolveDatabaseAdapter(runtime, environment);
  const checkoutConfig = resolveStripeCheckoutConfig(environment);
  const webhookConfig = resolveStripeWebhookConfig(environment);
  if (
    availability.status !== "ready" ||
    !environment.DATABASE_URL ||
    !checkoutConfig ||
    !webhookConfig
  ) {
    throw new Error("Ops payment checkout is unavailable.");
  }

  return createDbHumanTaskPaymentCheckoutService(createDb(environment.DATABASE_URL), {
    gateway: createStripeCheckoutGateway(checkoutConfig),
    retentionDays: checkoutConfig.retentionDays,
  });
}

export function setTestOpsHumanTaskService(service: HumanTaskService | null): void {
  if (service) store.__visepandaOpsTestHumanTasks = service;
  else delete store.__visepandaOpsTestHumanTasks;
}

export function setTestOpsHumanTaskPaymentCheckoutService(
  service: HumanTaskPaymentCheckoutService | null,
): void {
  if (service) store.__visepandaOpsTestHumanTaskPaymentCheckout = service;
  else delete store.__visepandaOpsTestHumanTaskPaymentCheckout;
}
