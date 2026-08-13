import { describe, expect, it } from "vitest";

import { listMobileTrips } from "./mobileTripAccess";

describe("mobile Trip access", () => {
  it("requires a bearer token and never accepts an arbitrary identity header", async () => {
    expect(
      await listMobileTrips(null, {
        getUser: async () => ({ id: "ignored" }),
        listTrips: async () => [],
      }),
    ).toEqual({ ok: false, status: 401, error: "Sign in is required to load Trips." });
  });

  it("derives the authenticated Trip owner only from a verified access token", async () => {
    const result = await listMobileTrips("Bearer aaaaaaaaaaaaaaaaaaaa", {
      getUser: async (token) =>
        token === "aaaaaaaaaaaaaaaaaaaa" ? { id: "user-1", email: "a@example.com" } : null,
      listTrips: async (identity) => {
        expect(identity).toEqual({
          kind: "authenticated",
          userId: "user-1",
          email: "a@example.com",
        });
        return [];
      },
    });
    expect(result).toEqual({ ok: true, trips: [] });
  });
});
