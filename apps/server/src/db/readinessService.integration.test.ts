import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbReadinessService } from "./readinessService.js";
import { ReadinessTripNotFoundError } from "../modules/readiness/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const accountUserId = "550e8400-e29b-41d4-a716-446655440021";
const otherUserId = "550e8400-e29b-41d4-a716-446655440022";
const anonymousTripId = "550e8400-e29b-41d4-a716-446655440023";
const anonymous = { kind: "anonymous" as const, anonId: "readiness-db-anon" };
const stranger = { kind: "anonymous" as const, anonId: "readiness-db-stranger" };
const account = {
  kind: "authenticated" as const,
  userId: accountUserId,
  email: "readiness-db@example.com",
};
const otherAccount = { kind: "authenticated" as const, userId: otherUserId };

describeDatabase("database ReadinessService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbReadinessService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.readiness_assessments where user_id in (${accountUserId}, ${otherUserId}) or trip_id = ${anonymousTripId}`;
    await sql`delete from public.trips where id = ${anonymousTripId}`;
    await sql`delete from public.users where id in (${accountUserId}, ${otherUserId})`;
    await sql`delete from auth.users where id in (${accountUserId}, ${otherUserId})`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values
        (${accountUserId}, 'authenticated', 'authenticated', 'readiness-db@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${otherUserId}, 'authenticated', 'authenticated', 'other-readiness-db@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`
      insert into public.users (id, email) values
        (${accountUserId}, 'readiness-db@example.com'),
        (${otherUserId}, 'other-readiness-db@example.com')
    `;
    await sql`
      insert into public.trips (id, anon_id, head_version, snapshot_jsonb)
      values (${anonymousTripId}, ${anonymous.anonId}, 0, '{}'::jsonb)
    `;
  });

  afterAll(async () => {
    await sql`delete from public.readiness_assessments where user_id in (${accountUserId}, ${otherUserId}) or trip_id = ${anonymousTripId}`;
    await sql`delete from public.trips where id = ${anonymousTripId}`;
    await sql`delete from public.users where id in (${accountUserId}, ${otherUserId})`;
    await sql`delete from auth.users where id in (${accountUserId}, ${otherUserId})`;
    await sql.end();
  });

  it("stores an authenticated account-level result without exposing it to another account", async () => {
    const saved = await service.save(
      {
        assessment: {
          version: 1,
          answers: [{ questionId: "payment_method", value: "confirmed" }],
          persistenceConsent: "granted",
        },
      },
      account,
    );

    await expect(service.latest(account)).resolves.toMatchObject({ id: saved.id });
    await expect(service.latest(otherAccount)).resolves.toBeNull();
  });

  it("requires current anonymous Trip ownership for persistence and reads", async () => {
    await service.save(
      {
        assessment: { version: 1, answers: [], persistenceConsent: "granted" },
        tripId: anonymousTripId,
      },
      anonymous,
    );

    await expect(service.latest(anonymous, { tripId: anonymousTripId })).resolves.toMatchObject({
      tripId: anonymousTripId,
    });
    await expect(service.latest(stranger, { tripId: anonymousTripId })).rejects.toBeInstanceOf(
      ReadinessTripNotFoundError,
    );
  });
});
