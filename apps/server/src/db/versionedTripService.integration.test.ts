import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbVersionedTripService } from "./versionedTripService.js";
import { TripVersionConflictError } from "../modules/trip/versionedService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const tripId = "20000000-0000-0000-0000-000000000001";
const userId = "20000000-0000-0000-0000-000000000002";
const trip = {
  id: tripId,
  title: "Shanghai",
  destinationCountry: "CN" as const,
  days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] }],
};
const anonA = { kind: "anonymous" as const, anonId: "integration-anon-a" };
const anonB = { kind: "anonymous" as const, anonId: "integration-anon-b" };

describeDatabase("database VersionedTripService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbVersionedTripService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.trips where id = ${tripId}`;
    await sql`delete from auth.users where id = ${userId}`;
  });

  afterAll(async () => {
    await sql`delete from public.trips where id = ${tripId}`;
    await sql`delete from auth.users where id = ${userId}`;
    await sql.end();
  });

  it("atomically accepts one concurrent version and appends one event", async () => {
    await service.create(trip, anonA, "user_manual");
    await expect(service.get(tripId, anonB)).resolves.toBeNull();

    const writes = await Promise.allSettled([
      service.apply({
        id: tripId,
        identity: anonA,
        expectedVersion: 1,
        patch: { operations: [{ op: "update_trip", fields: { title: "First" } }] },
        source: "user_manual",
      }),
      service.apply({
        id: tripId,
        identity: anonA,
        expectedVersion: 1,
        patch: { operations: [{ op: "update_trip", fields: { title: "Second" } }] },
        source: "user_manual",
      }),
    ]);

    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toBeInstanceOf(
      TripVersionConflictError,
    );
    await expect(service.get(tripId, anonA)).resolves.toMatchObject({ version: 2 });
    await expect(service.getEvents(tripId, anonA)).resolves.toHaveLength(2);
  });

  it("claims only an anonymous-owned row and remains idempotent", async () => {
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${userId}, 'authenticated', 'authenticated', 'trip-test@example.com', '',
        '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `;
    await service.create(trip, anonA, "user_manual");
    const identity = {
      kind: "authenticated" as const,
      userId,
      email: "trip-test@example.com",
      anonId: anonA.anonId,
    };

    await expect(service.claim(identity)).resolves.toMatchObject({ claimed: 1 });
    await expect(service.claim(identity)).resolves.toMatchObject({ claimed: 0 });
    await expect(service.get(tripId, anonA)).resolves.toBeNull();
    await expect(service.get(tripId, identity)).resolves.toMatchObject({ trip, version: 1 });
  });
});
