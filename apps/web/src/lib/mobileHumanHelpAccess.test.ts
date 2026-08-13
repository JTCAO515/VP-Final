import { describe, expect, it } from "vitest";

import { submitMobileHumanHelp } from "./mobileHumanHelpAccess";

const request = {
  city: "Shanghai",
  kind: "transport_help" as const,
  description: "Please help me confirm where to meet my driver in Shanghai.",
  contact: "traveler@example.com",
  idempotency_key: "00000000-0000-4000-8000-000000000701",
};

const receipt = {
  id: "task-701",
  status: "requested" as const,
  created_at: "2026-08-14T00:00:00.000Z",
};

describe("mobile Human Help access", () => {
  it("requires a verified bearer token and derives the owner only from it", async () => {
    await expect(
      submitMobileHumanHelp(null, request, {
        getUser: async () => ({ id: "ignored" }),
        submit: async () => receipt,
      }),
    ).resolves.toEqual({
      ok: false,
      status: 401,
      error: "Sign in is required to request Human Help.",
    });

    await expect(
      submitMobileHumanHelp("Bearer aaaaaaaaaaaaaaaaaaaa", request, {
        getUser: async () => ({ id: "user-701", email: "traveler@example.com" }),
        submit: async (identity, received) => {
          expect(identity).toEqual({
            kind: "authenticated",
            userId: "user-701",
            email: "traveler@example.com",
          });
          expect(received).toEqual(request);
          return receipt;
        },
      }),
    ).resolves.toEqual({ ok: true, task: receipt });
  });

  it("returns a minimal honest failure and never fabricates a receipt", async () => {
    await expect(
      submitMobileHumanHelp("Bearer aaaaaaaaaaaaaaaaaaaa", request, {
        getUser: async () => ({ id: "user-701" }),
        submit: async () => {
          throw Object.assign(new Error("daily limit"), {
            code: "TOO_MANY_REQUESTS",
            cause: { code: "HUMAN_TASK_IDENTITY_CAPACITY_REACHED" },
          });
        },
      }),
    ).resolves.toEqual({
      ok: false,
      status: 429,
      error:
        "Human Help accepts one new request per verified traveler each China day. Please try again tomorrow.",
    });
  });
});
