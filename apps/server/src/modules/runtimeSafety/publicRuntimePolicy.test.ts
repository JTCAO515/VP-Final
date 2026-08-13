import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTHENTICATED_RATE_LIMIT_HOUR,
  DEFAULT_AUTHENTICATED_RATE_LIMIT_MINUTE,
  DEFAULT_COPILOT_MAX_INPUT_CODE_UNITS,
  DEFAULT_COPILOT_MAX_OUTPUT_TOKENS,
  PublicRuntimePolicyUnavailableError,
  resolvePublicRuntimePolicy,
} from "./publicRuntimePolicy.js";

describe("public runtime policy", () => {
  it("uses the accepted ADR-0015 defaults", () => {
    expect(resolvePublicRuntimePolicy({})).toEqual({
      maxInputCodeUnits: DEFAULT_COPILOT_MAX_INPUT_CODE_UNITS,
      maxOutputTokens: DEFAULT_COPILOT_MAX_OUTPUT_TOKENS,
      authenticatedMinuteLimit: DEFAULT_AUTHENTICATED_RATE_LIMIT_MINUTE,
      authenticatedHourLimit: DEFAULT_AUTHENTICATED_RATE_LIMIT_HOUR,
      humanTaskDailyIdentityLimit: 1,
    });
  });

  it("allows each server setting to make its accepted ceiling stricter", () => {
    expect(
      resolvePublicRuntimePolicy({
        VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS: "4000",
        VISEPANDA_COPILOT_MAX_OUTPUT_TOKENS: "800",
        VISEPANDA_AUTHENTICATED_RATE_LIMIT_MINUTE: "10",
        VISEPANDA_AUTHENTICATED_RATE_LIMIT_HOUR: "60",
      }),
    ).toEqual({
      maxInputCodeUnits: 4000,
      maxOutputTokens: 800,
      authenticatedMinuteLimit: 10,
      authenticatedHourLimit: 60,
      humanTaskDailyIdentityLimit: 1,
    });
  });

  it.each([
    ["VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS", "0", "max_input_code_units_invalid"],
    ["VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS", "8001", "max_input_code_units_invalid"],
    ["VISEPANDA_COPILOT_MAX_OUTPUT_TOKENS", "1601", "max_output_tokens_invalid"],
    ["VISEPANDA_AUTHENTICATED_RATE_LIMIT_MINUTE", "21", "authenticated_minute_limit_invalid"],
    ["VISEPANDA_AUTHENTICATED_RATE_LIMIT_HOUR", "121", "authenticated_hour_limit_invalid"],
    ["VISEPANDA_COPILOT_MAX_OUTPUT_TOKENS", "1.5", "max_output_tokens_invalid"],
  ])("fails closed when %s=%s exceeds or violates the contract", (name, value, reason) => {
    expect(() => resolvePublicRuntimePolicy({ [name]: value })).toThrowError(
      expect.objectContaining<Partial<PublicRuntimePolicyUnavailableError>>({
        code: "PUBLIC_RUNTIME_POLICY_UNAVAILABLE",
        reason,
      }),
    );
  });
});
