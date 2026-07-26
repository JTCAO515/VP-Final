import {
  createDb,
  createDbOpsCostSummaryService,
  resolveDatabaseAdapter,
  resolveRuntimeMode,
  type OpsCostSummaryService,
} from "@visepanda/app-server";

export function getOpsCostSummaryService(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OpsCostSummaryService {
  const runtime = resolveRuntimeMode(environment);
  if (!runtime.ok || runtime.mode === "test" || runtime.mode === "local-demo") {
    throw new Error("Durable Copilot cost summary is unavailable in this runtime.");
  }
  const availability = resolveDatabaseAdapter(runtime, environment);
  if (availability.status !== "ready" || !environment.DATABASE_URL) {
    throw new Error("Durable Copilot cost summary is unavailable.");
  }
  return createDbOpsCostSummaryService(createDb(environment.DATABASE_URL));
}
