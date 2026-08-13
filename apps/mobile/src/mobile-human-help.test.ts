import { describe, expect, it } from "vitest";

import {
  createMobileHumanHelpIdempotencyKey,
  MobileHumanHelpError,
  submitMobileHumanHelp,
} from "./mobile-human-help.js";

const request = {
  city: "Shanghai",
  kind: "transport_help" as const,
  description: "Please help me confirm where to meet my driver in Shanghai.",
  contact: "traveler@example.com",
};

describe("mobile Human Help client", () => {
  it("creates an RFC 4122-shaped idempotency key for one form session", () => {
    expect(createMobileHumanHelpIdempotencyKey(() => 0)).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
  });

  it("sends a bearer token and returns only a minimal receipt", async () => {
    await expect(
      submitMobileHumanHelp({
        accessToken: "access-token",
        baseUrl: "https://go2china.space",
        request,
        idempotencyKey: "00000000-0000-4000-8000-000000000702",
        fetcher: async (url, init) => {
          expect(url).toBe("https://go2china.space/api/mobile/human-help");
          expect(init?.headers).toEqual({
            Authorization: "Bearer access-token",
            "content-type": "application/json",
          });
          return new Response(
            JSON.stringify({
              ok: true,
              task: {
                id: "task-702",
                status: "requested",
                created_at: "2026-08-14T00:00:00.000Z",
              },
            }),
            { status: 200 },
          );
        },
      }),
    ).resolves.toEqual({
      id: "task-702",
      status: "requested",
      created_at: "2026-08-14T00:00:00.000Z",
    });
  });

  it("does not pretend an offline submission succeeded", async () => {
    await expect(
      submitMobileHumanHelp({
        accessToken: "access-token",
        baseUrl: "https://go2china.space",
        request,
        fetcher: async () => {
          throw new Error("offline");
        },
      }),
    ).rejects.toEqual(
      new MobileHumanHelpError(
        "MOBILE_HUMAN_HELP_UNAVAILABLE",
        "Human Help is temporarily unavailable. Your request was not submitted.",
      ),
    );
  });
});
