import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createInMemoryTripService } from "./service.js";

const trip = {
  id: "trip-shanghai",
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [],
};

describe("tripRouter", () => {
  it("creates and reads trips through the tRPC caller", async () => {
    const tripService = createInMemoryTripService();
    const caller = appRouter.createCaller({ tripService });

    await expect(
      caller.trip.create({ trip, owner: { anonId: "anon-trip-router" } }),
    ).resolves.toEqual(trip);
    await expect(caller.trip.get({ id: trip.id, anonId: "anon-trip-router" })).resolves.toEqual(
      trip,
    );
    await expect(caller.trip.get({ id: trip.id, anonId: "anon-other" })).resolves.toBeNull();
    await expect(tripService.getEvents(trip.id)).resolves.toHaveLength(1);
  });

  it("claims anonymous trips for a signed-in user", async () => {
    const caller = appRouter.createCaller({
      tripService: createInMemoryTripService(),
    });

    await caller.trip.create({ trip, owner: { anonId: "anon-claim" } });
    const claim = await caller.trip.claimAnonymous({
      anonId: "anon-claim",
      userId: "4a47e0a6-8f79-4991-9f58-f3227bdfac6a",
      email: "traveler@example.com",
    });

    expect(claim.claimed).toBe(1);
    await expect(
      caller.trip.get({
        id: trip.id,
        userId: "4a47e0a6-8f79-4991-9f58-f3227bdfac6a",
      }),
    ).resolves.toEqual(trip);
  });

  it("creates public read-only share tokens for owned trips", async () => {
    const caller = appRouter.createCaller({
      tripService: createInMemoryTripService(),
    });

    await caller.trip.create({ trip, owner: { anonId: "anon-share" } });
    await expect(
      caller.trip.createShareToken({ id: trip.id, anonId: "anon-other" }),
    ).resolves.toBeNull();

    const shared = await caller.trip.createShareToken({ id: trip.id, anonId: "anon-share" });

    expect(shared?.token).toMatch(/^share_/);
    await expect(caller.trip.shared({ token: shared?.token ?? "" })).resolves.toEqual(trip);
  });
});
