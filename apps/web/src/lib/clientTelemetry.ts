import type { TelemetryCaptureInput } from "@visepanda/domain";

/**
 * Browser observations are best-effort only. The interaction that triggered
 * one must continue even when the trusted telemetry endpoint is unavailable.
 */
export function captureClientTelemetry(input: TelemetryCaptureInput): void {
  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch(() => undefined);
}
