import { describe, expect, it } from "vitest";

import {
  createReadOnlyTripOfflineCache,
  fetchMobileTrips,
  readMobileWebBaseUrl,
} from "./mobile-trip-sync.js";

const trip = {
  id: "trip-shanghai",
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [],
};

describe("mobile Trip sync", () => {
  it("uses the configured HTTPS VisePanda origin only", () => {
    expect(
      readMobileWebBaseUrl({ EXPO_PUBLIC_VISEPANDA_WEB_URL: "https://go2china.space/path" }),
    ).toBe("https://go2china.space");
    expect(
      readMobileWebBaseUrl({ EXPO_PUBLIC_VISEPANDA_WEB_URL: "http://go2china.space" }),
    ).toBeNull();
  });

  it("sends only a bearer session token and parses the shared read-only contract", async () => {
    const trips = await fetchMobileTrips({
      accessToken: "access-token",
      baseUrl: "https://go2china.space",
      fetcher: async (url, init) => {
        expect(url).toBe("https://go2china.space/api/mobile/trips");
        expect(init?.headers).toEqual({ Authorization: "Bearer access-token" });
        return new Response(JSON.stringify({ ok: true, trips: [{ trip, version: 1 }] }), {
          status: 200,
        });
      },
    });
    expect(trips).toEqual([{ trip, version: 1 }]);
  });

  it("keeps the previous cache intact when a session or payload is invalid", async () => {
    await expect(
      fetchMobileTrips({
        accessToken: "access-token",
        baseUrl: "https://go2china.space",
        fetcher: async () => new Response(JSON.stringify({ ok: false }), { status: 401 }),
      }),
    ).rejects.toMatchObject({ code: "MOBILE_SESSION_INVALID" });

    await expect(
      fetchMobileTrips({
        accessToken: "access-token",
        baseUrl: "https://go2china.space",
        fetcher: async () =>
          new Response(JSON.stringify({ ok: true, trips: [{ trip, version: 0 }] })),
      }),
    ).rejects.toMatchObject({ code: "MOBILE_SYNC_RESPONSE_INVALID" });
  });

  it("makes a bounded credential-free offline package from an owner-scoped snapshot", () => {
    const cache = createReadOnlyTripOfflineCache(
      {
        trip: {
          ...trip,
          days: [
            {
              id: "day-1",
              dayNumber: 1,
              city: "Shanghai",
              blocks: [
                {
                  id: "block-1",
                  type: "attraction",
                  title: "Yu Garden",
                  metadata: { authorization: "must-not-persist" },
                },
              ],
            },
          ],
        },
        version: 3,
      },
      new Date("2026-08-14T00:00:00.000Z"),
    );

    expect(cache.tripPackage?.cities).toEqual(["Shanghai"]);
    expect(cache.tripPackage?.expiresAt).toBe("2026-08-21T00:00:00.000Z");
    expect("metadata" in (cache.tripPackage?.trip.days[0]?.blocks[0] ?? {})).toBe(false);
  });
});
