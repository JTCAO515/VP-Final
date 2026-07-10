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
});
