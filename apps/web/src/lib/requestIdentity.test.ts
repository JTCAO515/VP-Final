import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  ANONYMOUS_SESSION_COOKIE,
  createAnonymousSessionValue,
  parseAnonymousSessionValue,
  readCookie,
  resolveRequestIdentity,
} from "./requestIdentity";

describe("anonymous request identity", () => {
  it("round-trips a server-signed anonymous id", () => {
    const value = createAnonymousSessionValue("test-secret", "a".repeat(43));
    expect(parseAnonymousSessionValue(value, "test-secret")).toBe("a".repeat(43));
  });

  it("rejects tampered values", () => {
    const value = createAnonymousSessionValue("test-secret", "a".repeat(43));
    expect(parseAnonymousSessionValue(`${value}x`, "test-secret")).toBeNull();
  });

  it("does not treat a body-like id as a cookie", () => {
    expect(readCookie("other=value", "vp_anon_session")).toBeUndefined();
  });

  it("issues an HttpOnly anonymous cookie for a new request", async () => {
    const previous = process.env.VISEPANDA_ANON_SESSION_SECRET;
    process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    const response = NextResponse.next();
    const identity = await resolveRequestIdentity(new Request("https://example.test/api/copilot"), response);

    expect(identity.kind).toBe("anonymous");
    const cookie = response.cookies.get(ANONYMOUS_SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);

    if (previous) process.env.VISEPANDA_ANON_SESSION_SECRET = previous;
    else delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  });

  it("fails honestly when production anonymous-session configuration is missing", async () => {
    const previousSecret = process.env.VISEPANDA_ANON_SESSION_SECRET;
    const previousNodeEnv = Object.getOwnPropertyDescriptor(process.env, "NODE_ENV");
    delete process.env.VISEPANDA_ANON_SESSION_SECRET;
    Object.defineProperty(process.env, "NODE_ENV", {
      configurable: true,
      enumerable: true,
      value: "production",
      writable: true,
    });
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    await expect(resolveRequestIdentity(new Request("https://example.test/api/copilot"), NextResponse.next())).rejects.toThrow(
      "Anonymous session configuration is unavailable.",
    );

    if (previousSecret) process.env.VISEPANDA_ANON_SESSION_SECRET = previousSecret;
    else delete process.env.VISEPANDA_ANON_SESSION_SECRET;
    if (previousNodeEnv) Object.defineProperty(process.env, "NODE_ENV", previousNodeEnv);
    else delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });
});
