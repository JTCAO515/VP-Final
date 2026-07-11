import { z } from "zod";

export const RuntimeModeSchema = z.enum(["test", "local-demo", "preview", "staging", "production"]);

export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export type RuntimeResolution =
  | {
      ok: true;
      mode: RuntimeMode;
      deployed: boolean;
      allowsMemory: boolean;
      label: "Demo mode" | "Test mode" | null;
    }
  | {
      ok: false;
      status: "unavailable";
      dependency: "runtime";
      code: "runtime_mode_missing" | "runtime_mode_invalid";
      message: string;
    };

export type AdapterAvailability = {
  status: "ready" | "degraded" | "unavailable";
  dependency: "database";
  adapter: "postgres" | "memory-demo" | string | null;
  code:
    | "runtime_unavailable"
    | "database_url_missing"
    | "demo_memory_selected"
    | "test_adapter_missing"
    | null;
  message: string | null;
};

export function resolveRuntimeMode(environment: RuntimeEnvironment): RuntimeResolution {
  const value = environment.VISEPANDA_RUNTIME_MODE;
  if (!value) {
    return {
      ok: false,
      status: "unavailable",
      dependency: "runtime",
      code: "runtime_mode_missing",
      message: "VISEPANDA_RUNTIME_MODE must be selected explicitly.",
    };
  }

  const parsed = RuntimeModeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      status: "unavailable",
      dependency: "runtime",
      code: "runtime_mode_invalid",
      message: "VISEPANDA_RUNTIME_MODE is not an accepted runtime mode.",
    };
  }

  const mode = parsed.data;
  return {
    ok: true,
    mode,
    deployed: mode === "preview" || mode === "staging" || mode === "production",
    allowsMemory: mode === "test" || mode === "local-demo",
    label: mode === "local-demo" ? "Demo mode" : mode === "test" ? "Test mode" : null,
  };
}

export function resolveDatabaseAdapter(
  runtime: RuntimeResolution,
  environment: RuntimeEnvironment,
  injectedTestAdapter?: string,
): AdapterAvailability {
  if (!runtime.ok) {
    return {
      status: "unavailable",
      dependency: "database",
      adapter: null,
      code: "runtime_unavailable",
      message: "The runtime mode must be valid before selecting a database adapter.",
    };
  }

  if (runtime.mode === "test") {
    return injectedTestAdapter
      ? {
          status: "ready",
          dependency: "database",
          adapter: injectedTestAdapter,
          code: null,
          message: null,
        }
      : {
          status: "unavailable",
          dependency: "database",
          adapter: null,
          code: "test_adapter_missing",
          message: "Tests must inject an adapter explicitly.",
        };
  }

  if (environment.DATABASE_URL) {
    return {
      status: "ready",
      dependency: "database",
      adapter: "postgres",
      code: null,
      message: null,
    };
  }

  if (runtime.mode === "local-demo") {
    return {
      status: "degraded",
      dependency: "database",
      adapter: "memory-demo",
      code: "demo_memory_selected",
      message: "Demo mode uses non-durable in-memory data.",
    };
  }

  return {
    status: "unavailable",
    dependency: "database",
    adapter: null,
    code: "database_url_missing",
    message: "The durable database is not configured for this runtime.",
  };
}

export const adapterInventory = [
  {
    object: "trip",
    productionOwner: "apps/server Trip service + Postgres adapter",
    forbiddenProductionPath: "Web or process-local Trip state",
    canonicalIssue: "#113 / P0-04",
  },
  {
    object: "human-task",
    productionOwner: "apps/server Human Task service + Postgres adapter",
    forbiddenProductionPath: "app-local task ledger",
    canonicalIssue: "#150 / P0-13",
  },
  {
    object: "outbound-commerce",
    productionOwner: "apps/server Commerce service + Postgres adapter",
    forbiddenProductionPath: "in-memory click ledger or raw redirect",
    canonicalIssue: "#155 / P0-18",
  },
  {
    object: "telemetry",
    productionOwner: "apps/server Telemetry service + Postgres adapter",
    forbiddenProductionPath: "per-route event array",
    canonicalIssue: "#156 / P0-19",
  },
  {
    object: "agent-trace",
    productionOwner: "apps/server Trace service + Postgres adapter",
    forbiddenProductionPath: "provider-log-only record",
    canonicalIssue: "#73 / P0-09",
  },
  {
    object: "knowledge",
    productionOwner: "apps/server Knowledge service + Postgres adapter",
    forbiddenProductionPath: "browser or Ops process-local fact store",
    canonicalIssue: "#115 / P0-06",
  },
  {
    object: "ops-authorization",
    productionOwner: "apps/server Ops Authorization service + Postgres adapter",
    forbiddenProductionPath: "client role or email allowlist",
    canonicalIssue: "#114 / P0-05",
  },
] as const;
