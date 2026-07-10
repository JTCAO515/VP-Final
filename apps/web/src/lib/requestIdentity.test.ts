import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  ANONYMOUS_SESSION_COOKIE,
  createAnonymousSessionValue,
  identityFields,
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

  it("rejects an expired signed session", () => {
    const issuedAt = 1_700_000_000;
    const value = createAnonymousSessionValue("test-secret", "a".repeat(43), issuedAt);
    expect(
      parseAnonymousSessionValue(value, "test-secret", issuedAt + 60 * 60 * 24 * 31),
    ).toBeNull();
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
    const identity = await resolveRequestIdentity(
      new Request("https://example.test/api/copilot"),
      response,
    );

    expect(identity.kind).toBe("anonymous");
    const cookie = response.cookies.get(ANONYMOUS_SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);

    if (previous) process.env.VISEPANDA_ANON_SESSION_SECRET = previous;
    else delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  });

  it("rotates a session signed by the previous key without changing its id", async () => {
    const previousEnv = {
      secret: process.env.VISEPANDA_ANON_SESSION_SECRET,
      keyId: process.env.VISEPANDA_ANON_SESSION_KEY_ID,
      previousSecret: process.env.VISEPANDA_ANON_SESSION_PREVIOUS_SECRET,
      previousKeyId: process.env.VISEPANDA_ANON_SESSION_PREVIOUS_KEY_ID,
    };
    process.env.VISEPANDA_ANON_SESSION_SECRET = "new-secret";
    process.env.VISEPANDA_ANON_SESSION_KEY_ID = "new";
    process.env.VISEPANDA_ANON_SESSION_PREVIOUS_SECRET = "old-secret";
    process.env.VISEPANDA_ANON_SESSION_PREVIOUS_KEY_ID = "old";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    const anonId = "b".repeat(43);
    const previousCookie = createAnonymousSessionValue(
      "old-secret",
      anonId,
      Math.floor(Date.now() / 1000),
      "old",
    );
    const response = NextResponse.next();

    const identity = await resolveRequestIdentity(
      new Request("https://example.test/api/copilot", {
        headers: { cookie: `${ANONYMOUS_SESSION_COOKIE}=${previousCookie}` },
      }),
      response,
    );

    expect(identity).toEqual({ kind: "anonymous", anonId });
    expect(response.cookies.get(ANONYMOUS_SESSION_COOKIE)?.value).toContain(".new.");
    restoreEnv("VISEPANDA_ANON_SESSION_SECRET", previousEnv.secret);
    restoreEnv("VISEPANDA_ANON_SESSION_KEY_ID", previousEnv.keyId);
    restoreEnv("VISEPANDA_ANON_SESSION_PREVIOUS_SECRET", previousEnv.previousSecret);
    restoreEnv("VISEPANDA_ANON_SESSION_PREVIOUS_KEY_ID", previousEnv.previousKeyId);
  });

  it("uses the verified Supabase user and retains only the signed anonymous id for claim", async () => {
    const previous = process.env.VISEPANDA_ANON_SESSION_SECRET;
    process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret";
    const anonId = "c".repeat(43);
    const cookie = createAnonymousSessionValue("test-secret", anonId);

    const identity = await resolveRequestIdentity(
      new Request("https://example.test/api/copilot?userId=forged", {
        headers: { cookie: `${ANONYMOUS_SESSION_COOKIE}=${cookie}` },
      }),
      NextResponse.next(),
      {
        getUser: async () => ({
          data: { user: { id: "verified-user", email: "user@example.com" } },
        }),
      },
    );

    expect(identity).toEqual({
      kind: "authenticated",
      userId: "verified-user",
      email: "user@example.com",
      anonId,
    });
    expect({ userId: "forged", anonId: "forged", ...identityFields(identity) }).toEqual({
      userId: "verified-user",
      anonId,
      email: "user@example.com",
    });
    restoreEnv("VISEPANDA_ANON_SESSION_SECRET", previous);
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

    await expect(
      resolveRequestIdentity(new Request("https://example.test/api/copilot"), NextResponse.next()),
    ).rejects.toThrow("Anonymous session configuration is unavailable.");

    if (previousSecret) process.env.VISEPANDA_ANON_SESSION_SECRET = previousSecret;
    else delete process.env.VISEPANDA_ANON_SESSION_SECRET;
    if (previousNodeEnv) Object.defineProperty(process.env, "NODE_ENV", previousNodeEnv);
    else delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
