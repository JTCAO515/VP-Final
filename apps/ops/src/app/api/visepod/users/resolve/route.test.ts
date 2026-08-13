import {
  VisePodBindingProvisioningAccessDeniedError,
  VisePodStudioUserLookupRateLimitUnavailableError,
  VisePodUserLookupNotFoundError,
  VisePodUserLookupRateLimitedError,
  type VisePodUserResolutionService,
} from "@visepanda/app-server";
import { describe, expect, it } from "vitest";
import { handleVisePodUserResolve } from "./handler";

const token = "provisioning-token-012345678901234567890123456789";
const userId = "34000000-0000-4000-8000-000000000002";
const email = "traveler@example.test";

function request(body: Record<string, string>, authorization = `Bearer ${token}`) {
  return new Request("https://ops.example.test/api/ops/visepod/users/resolve", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(service: VisePodUserResolutionService) {
  return { getRuntime: () => ({ environment: "development" as const, service }) };
}

describe("VisePod exact-user lookup route", () => {
  it("rejects malformed bearer before constructing a runtime", async () => {
    let constructed = false;
    const response = await handleVisePodUserResolve(request({ email }, "invalid"), {
      getRuntime: () => {
        constructed = true;
        throw new Error("must not construct runtime");
      },
    });
    expect(response.status).toBe(400);
    expect(constructed).toBe(false);
  });

  it("returns only the minimized exact resolution response", async () => {
    let captured: unknown;
    const response = await handleVisePodUserResolve(
      request({ email }),
      dependencies({
        async resolve(input) {
          captured = input;
          return { userId, displayName: null, emailHint: "t***@example.test" };
        },
      }),
    );
    expect(response.status).toBe(200);
    const serialized = await response.text();
    expect(JSON.parse(serialized)).toEqual({
      user: { userId, displayName: null, emailHint: "t***@example.test" },
    });
    expect(captured).toMatchObject({ environment: "development", request: { email } });
    expect(serialized).not.toContain(email);
  });

  it.each([
    [new VisePodBindingProvisioningAccessDeniedError(), 403, "PROVISIONING_ACCESS_DENIED"],
    [new VisePodUserLookupNotFoundError(), 404, "USER_NOT_FOUND"],
    [new VisePodUserLookupRateLimitedError(17), 429, "USER_LOOKUP_RATE_LIMITED"],
    [
      new VisePodStudioUserLookupRateLimitUnavailableError("redis_request_failed"),
      503,
      "USER_LOOKUP_UNAVAILABLE",
    ],
  ] as const)(
    "maps neutral %s errors without echoing request identifiers",
    async (error, status, code) => {
      const response = await handleVisePodUserResolve(
        request({ email }),
        dependencies({
          async resolve() {
            throw error;
          },
        }),
      );
      expect(response.status).toBe(status);
      const serialized = await response.text();
      expect(JSON.parse(serialized)).toEqual({ error: { code } });
      expect(serialized).not.toContain(email);
      if (status === 429) expect(response.headers.get("retry-after")).toBe("17");
    },
  );

  it("does not accept partial, prefix, or multiple lookup identifiers", async () => {
    const service: VisePodUserResolutionService = {
      async resolve() {
        throw new Error("route must reject before service");
      },
    };
    for (const body of [
      { email: "traveler@example" },
      { email: "traveler@example.test", userId },
      {},
    ]) {
      const response = await handleVisePodUserResolve(request(body), dependencies(service));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: { code: "INVALID_REQUEST" } });
    }
  });
});
