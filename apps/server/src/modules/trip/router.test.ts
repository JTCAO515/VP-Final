import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "./versionedService.js";

const trip = {
  id: "trip-shanghai",
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [],
};
const anonA = { kind: "anonymous" as const, anonId: "anon-a" };
const anonB = { kind: "anonymous" as const, anonId: "anon-b" };

describe("tripRouter", () => {
  it("requires trusted context and ignores any possibility of client owner input", async () => {
    const tripService = createVersionedInMemoryTripService();
    const none = appRouter.createCaller({ tripService, identity: { kind: "none" } });
    await expect(none.trip.create(trip)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const callerA = appRouter.createCaller({ tripService, identity: anonA });
    const callerB = appRouter.createCaller({ tripService, identity: anonB });
    await expect(callerA.trip.create(trip)).resolves.toMatchObject({ version: 1, trip });
    await expect(callerB.trip.get({ id: trip.id })).resolves.toBeNull();
    await expect(
      callerB.trip.applyPatch({
        id: trip.id,
        expectedVersion: 1,
        patch: { operations: [{ op: "update_trip", fields: { title: "Taken" } }] },
      }),
    ).resolves.toBeNull();
  });

  it("maps stale writes to a typed conflict with safe current version", async () => {
    const tripService = createVersionedInMemoryTripService();
    const caller = appRouter.createCaller({ tripService, identity: anonA });
    await caller.trip.create(trip);
    await caller.trip.applyPatch({
      id: trip.id,
      expectedVersion: 1,
      patch: { operations: [{ op: "update_trip", fields: { title: "Accepted" } }] },
    });

    const conflict = await caller.trip
      .applyPatch({
        id: trip.id,
        expectedVersion: 1,
        patch: { operations: [{ op: "update_trip", fields: { title: "Stale" } }] },
      })
      .catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(TRPCError);
    expect(conflict).toMatchObject({ code: "CONFLICT", cause: { currentVersion: 2 } });
  });

  it("claims from the current signed anonymous context and revokes sharing", async () => {
    const tripService = createVersionedInMemoryTripService();
    const anonCaller = appRouter.createCaller({ tripService, identity: anonA });
    await anonCaller.trip.create(trip);
    const token = await anonCaller.trip.createShareToken({ id: trip.id });
    await expect(anonCaller.trip.shared({ token: token?.token ?? "" })).resolves.toEqual(trip);

    const userCaller = appRouter.createCaller({
      tripService,
      identity: {
        kind: "authenticated",
        userId: "user-a",
        email: "a@example.com",
        anonId: anonA.anonId,
      },
    });
    await expect(userCaller.trip.claimAnonymous()).resolves.toMatchObject({ claimed: 1 });
    await expect(userCaller.trip.revokeShareToken({ id: trip.id })).resolves.toBe(true);
    await expect(userCaller.trip.shared({ token: token?.token ?? "" })).resolves.toBeNull();
  });
});
