import { describe, expect, it } from "vitest";

import { readMobileAuthConfig } from "./mobile-auth.js";

describe("mobile auth configuration", () => {
  it("accepts only HTTPS Supabase public configuration", () => {
    expect(
      readMobileAuthConfig({
        EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co/path-is-not-used",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toEqual({
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "public-anon-key",
    });
  });

  it("fails closed for missing or non-HTTPS public configuration", () => {
    expect(readMobileAuthConfig({})).toBeNull();
    expect(
      readMobileAuthConfig({
        EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      }),
    ).toBeNull();
  });
});
