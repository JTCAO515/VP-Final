export const DEFAULT_COPILOT_MAX_INPUT_CODE_UNITS = 8_000;
export const DEFAULT_COPILOT_MAX_OUTPUT_TOKENS = 1_600;
export const DEFAULT_AUTHENTICATED_RATE_LIMIT_MINUTE = 20;
export const DEFAULT_AUTHENTICATED_RATE_LIMIT_HOUR = 120;
export const HUMAN_TASK_DAILY_IDENTITY_LIMIT = 1;

type Environment = Readonly<Record<string, string | undefined>>;

export type PublicRuntimePolicy = {
  maxInputCodeUnits: number;
  maxOutputTokens: number;
  authenticatedMinuteLimit: number;
  authenticatedHourLimit: number;
  humanTaskDailyIdentityLimit: typeof HUMAN_TASK_DAILY_IDENTITY_LIMIT;
};

export class PublicRuntimePolicyUnavailableError extends Error {
  readonly code = "PUBLIC_RUNTIME_POLICY_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("The public runtime safety policy is unavailable.");
    this.name = "PublicRuntimePolicyUnavailableError";
  }
}

export function resolvePublicRuntimePolicy(environment: Environment): PublicRuntimePolicy {
  return {
    maxInputCodeUnits: boundedPositiveInteger(
      environment.VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS,
      DEFAULT_COPILOT_MAX_INPUT_CODE_UNITS,
      DEFAULT_COPILOT_MAX_INPUT_CODE_UNITS,
      "max_input_code_units_invalid",
    ),
    maxOutputTokens: boundedPositiveInteger(
      environment.VISEPANDA_COPILOT_MAX_OUTPUT_TOKENS,
      DEFAULT_COPILOT_MAX_OUTPUT_TOKENS,
      DEFAULT_COPILOT_MAX_OUTPUT_TOKENS,
      "max_output_tokens_invalid",
    ),
    authenticatedMinuteLimit: boundedPositiveInteger(
      environment.VISEPANDA_AUTHENTICATED_RATE_LIMIT_MINUTE,
      DEFAULT_AUTHENTICATED_RATE_LIMIT_MINUTE,
      DEFAULT_AUTHENTICATED_RATE_LIMIT_MINUTE,
      "authenticated_minute_limit_invalid",
    ),
    authenticatedHourLimit: boundedPositiveInteger(
      environment.VISEPANDA_AUTHENTICATED_RATE_LIMIT_HOUR,
      DEFAULT_AUTHENTICATED_RATE_LIMIT_HOUR,
      DEFAULT_AUTHENTICATED_RATE_LIMIT_HOUR,
      "authenticated_hour_limit_invalid",
    ),
    humanTaskDailyIdentityLimit: HUMAN_TASK_DAILY_IDENTITY_LIMIT,
  };
}

function boundedPositiveInteger(
  raw: string | undefined,
  fallback: number,
  ceiling: number,
  reason: string,
): number {
  const value = raw?.trim() ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1 || value > ceiling) {
    throw new PublicRuntimePolicyUnavailableError(reason);
  }
  return value;
}
