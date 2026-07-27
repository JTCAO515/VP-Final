import type { TelemetryInput, TelemetryService } from "./service.js";

/**
 * Product telemetry is observational. It must never delay or change the
 * authoritative operation that caused it.
 */
export function recordTelemetrySafely(
  service: TelemetryService | undefined,
  input: TelemetryInput,
  failureLog: string,
): void {
  if (!service) return;

  void service.track(input).catch(() => {
    console.warn(failureLog, { failureClass: "persistence_error" });
  });
}
