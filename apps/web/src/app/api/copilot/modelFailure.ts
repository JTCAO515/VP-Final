import { DemoModelExecutionError, DemoModelUnavailableError } from "@visepanda/app-server";

export type DemoModelFailure = DemoModelUnavailableError | DemoModelExecutionError;

export function findModelFailure(error: unknown): DemoModelFailure | null {
  if (error instanceof DemoModelUnavailableError || error instanceof DemoModelExecutionError) {
    return error;
  }
  if (error && typeof error === "object" && "cause" in error) {
    return findModelFailure((error as { cause?: unknown }).cause);
  }
  return null;
}

export type SanitizedModelFailureDiagnostic = {
  code: DemoModelFailure["code"];
  attempts: Array<{
    provider: string;
    model: string;
    failureClass: string | null;
    latencyMs: number;
  }>;
};

/**
 * Runtime diagnostics deliberately omit prompts, provider response bodies, and credentials.
 * They make a production provider outage actionable without widening the public error contract.
 */
export function summarizeModelFailure(error: unknown): SanitizedModelFailureDiagnostic | null {
  const failure = findModelFailure(error);
  if (!failure) return null;
  if (!(failure instanceof DemoModelExecutionError)) {
    return { code: failure.code, attempts: [] };
  }

  return {
    code: failure.code,
    attempts: failure.attempts.map((attempt) => ({
      provider: attempt.provider,
      model: attempt.model,
      failureClass: attempt.failureClass ?? null,
      latencyMs: attempt.latencyMs,
    })),
  };
}
