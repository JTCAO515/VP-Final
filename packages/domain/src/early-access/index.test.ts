import { describe, expect, it } from "vitest";
import { EarlyAccessSignupInputSchema, normalizeEarlyAccessEmail } from "./index.js";

describe("EarlyAccessSignupInputSchema", () => {
  it("normalizes email and applies the Landing defaults", () => {
    expect(EarlyAccessSignupInputSchema.parse({ email: "  Traveler@Example.COM " })).toEqual({
      email: "traveler@example.com",
      locale: "en",
      source: "landing",
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
  });

  it("exposes the same canonicalization as the schema", () => {
    expect(normalizeEarlyAccessEmail("  A@EXAMPLE.COM ")).toBe("a@example.com");
  });
});
