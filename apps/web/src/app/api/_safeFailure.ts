export type SafeRouteFailure = Readonly<{
  route: "/api/copilot";
  capability: "copilot";
  failureClass:
    | "anonymous_turn_control_unavailable"
    | "model_provider_failure"
    | "request_protection_unavailable"
    | "runtime_policy_unavailable"
    | "runtime_unavailable"
    | "unexpected_error";
}>;

/**
 * This deliberately accepts no Error object or request context. Route logs may carry only the
 * generated support reference and normalized operational labels.
 */
export function reportSafeRouteFailure(
  failure: SafeRouteFailure,
  createCorrelationId: () => string = () => crypto.randomUUID(),
): string {
  const correlationId = createCorrelationId();
  console.error("web_route_failure", { correlationId, ...failure });
  return correlationId;
}
