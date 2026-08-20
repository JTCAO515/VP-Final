import { describe, expect, it } from "vitest";
import {
  EARLY_ACCESS_PRIMARY_CONCERNS,
  EarlyAccessSignupInputSchema,
  normalizeEarlyAccessEmail,
} from "./index.js";

describe("EarlyAccessSignupInputSchema", () => {
  it("normalizes email and applies the Landing defaults", () => {
    expect(EarlyAccessSignupInputSchema.parse({ email: "  Traveler@Example.COM " })).toEqual({
      email: "traveler@example.com",
      locale: "en",
      source: "landing",
      primaryConcern: undefined,
    });
  });

  it("rejects invalid email, locale, and source values", () => {
    expect(EarlyAccessSignupInputSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(
      EarlyAccessSignupInputSchema.safeParse({
        email: "traveler@example.com",
        locale: "english locale",
      }).success,
    ).toBe(false);
    expect(
      EarlyAccessSignupInputSchema.safeParse({
        email: "traveler@example.com",
        source: "partner",
      }).success,
    ).toBe(false);
    expect(
      EarlyAccessSignupInputSchema.safeParse({
        email: "traveler@example.com",
        primaryConcern: "free_text_is_not_allowed",
      }).success,
    ).toBe(false);
  });

  it("accepts only the fixed optional concern vocabulary", () => {
    expect(EARLY_ACCESS_PRIMARY_CONCERNS).toHaveLength(10);
    expect(
      EarlyAccessSignupInputSchema.parse({
        email: "traveler@example.com",
        primaryConcern: "internet_and_essential_apps",
      }).primaryConcern,
    ).toBe("internet_and_essential_apps");
  });

  it("exposes the same canonicalization as the schema", () => {
    expect(normalizeEarlyAccessEmail("  A@EXAMPLE.COM ")).toBe("a@example.com");
  });
});
