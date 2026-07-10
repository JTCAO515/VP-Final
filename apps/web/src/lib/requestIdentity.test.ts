import { describe, expect, it } from "vitest";
import { createAnonymousSessionValue, parseAnonymousSessionValue, readCookie } from "./requestIdentity";

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
});
