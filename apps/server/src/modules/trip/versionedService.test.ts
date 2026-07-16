import { describe, expect, it } from "vitest";
import {
  createVersionedInMemoryTripService,
  TripVersionConflictError,
} from "./versionedService.js";

const trip = {
  id: "trip-shanghai",
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] }],
};
const anonA = { kind: "anonymous" as const, anonId: "anon-a" };
const anonB = { kind: "anonymous" as const, anonId: "anon-b" };
const userA = { kind: "authenticated" as const, userId: "user-a", email: "a@example.com" };
const userB = { kind: "authenticated" as const, userId: "user-b" };

describe("VersionedTripService", () => {
  it("keeps private reads and event history owner-scoped", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, anonA, "user_manual");

    await expect(service.get(trip.id, anonA)).resolves.toMatchObject({ version: 1, trip });
    await expect(service.get(trip.id, anonB)).resolves.toBeNull();
    await expect(service.getEvents(trip.id, anonB)).resolves.toBeNull();
    await expect(service.list(anonB)).resolves.toEqual([]);
  });

  it("does not let another authenticated user mutate an owned trip", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, userA, "user_manual");

    await expect(
      service.apply({
        id: trip.id,
        identity: userB,
        expectedVersion: 1,
        patch: { operations: [{ op: "update_trip", fields: { title: "Taken over" } }] },
        source: "user_manual",
      }),
    ).resolves.toBeNull();
    await expect(service.get(trip.id, userB)).resolves.toBeNull();
    await expect(service.get(trip.id, userA)).resolves.toMatchObject({
      version: 1,
      trip: { title: "Shanghai" },
    });
  });

  it("applies a patch at the expected version and appends exactly one event", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, anonA, "user_manual");

    const result = await service.apply({
      id: trip.id,
      identity: anonA,
      expectedVersion: 1,
      patch: { operations: [{ op: "update_trip", fields: { title: "Shanghai weekend" } }] },
      source: "user_manual",
    });

    expect(result).toMatchObject({ version: 2, trip: { title: "Shanghai weekend" } });
    await expect(service.getEvents(trip.id, anonA)).resolves.toHaveLength(2);
  });

  it("retains server-only completion provenance on its Trip event", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, anonA, "user_manual");
    const completion = {
      jobId: "59bf9155-8a71-442f-9c63-127a033f9564",
      attempt: 1,
    };

    await service.apply({
      id: trip.id,
      identity: anonA,
      expectedVersion: 1,
      patch: { operations: [{ op: "update_trip", fields: { title: "Completed" } }] },
      source: "ai_copilot",
      completion,
    });

    await expect(service.getEvents(trip.id, anonA)).resolves.toContainEqual(
      expect.objectContaining({ version: 2, completion }),
    );
  });

  it("rejects a stale version without changing snapshot or events", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, anonA, "user_manual");
    await service.apply({
      id: trip.id,
      identity: anonA,
      expectedVersion: 1,
      patch: { operations: [{ op: "update_trip", fields: { title: "Accepted" } }] },
      source: "user_manual",
    });

    await expect(
      service.apply({
        id: trip.id,
        identity: anonA,
        expectedVersion: 1,
        patch: { operations: [{ op: "update_trip", fields: { title: "Stale" } }] },
        source: "user_manual",
      }),
    ).rejects.toEqual(new TripVersionConflictError(2));
    await expect(service.get(trip.id, anonA)).resolves.toMatchObject({
      version: 2,
      trip: { title: "Accepted" },
    });
    await expect(service.getEvents(trip.id, anonA)).resolves.toHaveLength(2);
  });

  it("treats an empty patch as a no-op", async () => {
    const service = createVersionedInMemoryTripService();
    const created = await service.create(trip, anonA, "user_manual");
    const result = await service.apply({
      id: trip.id,
      identity: anonA,
      expectedVersion: created.version,
      patch: { operations: [] },
      source: "user_manual",
    });

    expect(result).toEqual(created);
    await expect(service.getEvents(trip.id, anonA)).resolves.toHaveLength(1);
  });

  it("claims only the current signed anonymous owner's trips and is idempotent", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, anonA, "user_manual");

    await expect(service.claim({ ...userA, anonId: anonA.anonId })).resolves.toMatchObject({
      claimed: 1,
    });
    await expect(service.claim({ ...userA, anonId: anonA.anonId })).resolves.toMatchObject({
      claimed: 0,
    });
    await expect(service.get(trip.id, anonA)).resolves.toBeNull();
    await expect(service.get(trip.id, userA)).resolves.toMatchObject({ trip });
    await expect(service.claim({ ...userB, anonId: anonA.anonId })).resolves.toMatchObject({
      claimed: 0,
    });
  });

  it("never transfers an already authenticated trip", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, userA, "user_manual");

    await expect(service.claim({ ...userB, anonId: anonA.anonId })).resolves.toEqual({
      claimed: 0,
      trips: [],
    });
    await expect(service.get(trip.id, userA)).resolves.toMatchObject({ trip });
    await expect(service.get(trip.id, userB)).resolves.toBeNull();
  });

  it("creates owner-only read-only share capabilities and revokes them", async () => {
    const service = createVersionedInMemoryTripService();
    await service.create(trip, anonA, "user_manual");

    await expect(service.createShareToken(trip.id, anonB)).resolves.toBeNull();
    const shared = await service.createShareToken(trip.id, anonA);
    expect(shared?.token).toMatch(/^share_/);
    await expect(service.getByShareToken(shared?.token ?? "")).resolves.toEqual(trip);
    await expect(service.revokeShareToken(trip.id, anonB)).resolves.toBe(false);
    await expect(service.revokeShareToken(trip.id, anonA)).resolves.toBe(true);
    await expect(service.getByShareToken(shared?.token ?? "")).resolves.toBeNull();
  });
});
