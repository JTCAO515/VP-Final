import { describe, expect, it } from "vitest";
import {
  TrustedClientAddressUnavailableError,
  resolveTrustedCopilotClientAddress,
} from "./trustedClient";

describe("resolveTrustedCopilotClientAddress", () => {
  it("uses only the first valid Vercel-provided address", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "invalid, 203.0.113.9, 198.51.100.7",
      "x-forwarded-for": "192.0.2.99",
    });

    expect(
      resolveTrustedCopilotClientAddress(headers, {
        VERCEL: "1",
        VISEPANDA_RUNTIME_MODE: "preview",
      }),
    ).toBe("203.0.113.9");
  });

  it("does not accept spoofable x-forwarded-for on Vercel", () => {
    expect(() =>
      resolveTrustedCopilotClientAddress(new Headers({ "x-forwarded-for": "203.0.113.10" }), {
        VERCEL: "1",
        VISEPANDA_RUNTIME_MODE: "production",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "TRUSTED_CLIENT_ADDRESS_UNAVAILABLE",
        reason: "trusted_header_missing",
      }),
    );
  });

  it("canonicalizes equivalent IPv6 spellings into the same limiter identity", () => {
    const environment = { VERCEL: "1", VISEPANDA_RUNTIME_MODE: "production" };
    expect(
      resolveTrustedCopilotClientAddress(
        new Headers({ "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:1" }),
        environment,
      ),
    ).toBe("2001:db8::1");
    expect(
      resolveTrustedCopilotClientAddress(
        new Headers({ "x-vercel-forwarded-for": "2001:db8::1" }),
        environment,
      ),
    ).toBe("2001:db8::1");
  });

  it("uses one fixed local identity and ignores forwarding headers outside Vercel", () => {
    const environment = { VISEPANDA_RUNTIME_MODE: "test" };
    expect(
      resolveTrustedCopilotClientAddress(
        new Headers({ "x-forwarded-for": "203.0.113.10" }),
        environment,
      ),
    ).toBe("local-runtime");
    expect(
      resolveTrustedCopilotClientAddress(
        new Headers({ "x-vercel-forwarded-for": "198.51.100.20" }),
        environment,
      ),
    ).toBe("local-runtime");
  });

  it("fails closed in a deployed mode outside the trusted Vercel boundary", () => {
    expect(() =>
      resolveTrustedCopilotClientAddress(new Headers(), {
        VISEPANDA_RUNTIME_MODE: "staging",
      }),
    ).toThrowError(TrustedClientAddressUnavailableError);
  });
});
